import { MikroORM, Options } from '@mikro-orm/better-sqlite';
import { Embeddable, Embedded, Entity, EntityClass, PrimaryKey, Property } from '@mikro-orm/core';

@Embeddable()
class Address {

  @Property()
  city!: string;

}


@Embeddable()
class Company {

  @Property()
  name!: string;

  @Embedded(() => Address, { prefix: 'addr_', prefixBehavior: 'relative' })
  address!: Address;

  @Embedded(() => Address, { prefix: 'addr2_' /* behavior from configuration */ })
  address2!: Address;

}

@Entity()
class Person {

  @PrimaryKey()
  id!: number;

  @Embedded(() => Address)
  address!: Address;

  @Embedded(() => Company, { prefix: 'comp_' })
  company!: Company;

}

describe('GH #6112', () => {
  let orm: MikroORM;

  afterEach(async () => {
    if (!orm) {
      return;
    }

    orm.em.clear();
    await orm.close();
  });

  async function loadORM(entity: EntityClass<any>, options: Options = {}) {
    // and get field names
    orm = await MikroORM.init({
      dbName: ':memory:',
      strict: true,
      validate: true,
      validateRequired: true,
      ...options,
      entities: [entity],
    });
    await orm.schema.createSchema();

    const meta = orm.getMetadata().get(entity);
    return {
      fieldNames: meta.comparableProps
        .map(({ name, fieldNames }) => [name, fieldNames[0]])
        .sort(([a], [b]) => a.localeCompare(b)),
      orm,
    };
  }

  it('should have the property prefixed with the one of its parent', async () => {
    const { fieldNames, orm } = await loadORM(Person);
    expect(fieldNames).toStrictEqual([
      [ 'address', 'address' ],
      [ 'address_city', 'address_city' ],
      // behavior: relative
      [ 'comp_address_city', 'comp_addr_city' ],
      // behavior: absolute
      [ 'comp_address2_city', 'addr2_city' ],
      [ 'company', 'company' ],
      [ 'company_address', 'comp_address' ],
      [ 'company_address2', 'comp_address2' ],
      [ 'company_name', 'comp_name' ],
      [ 'id', 'id' ],
    ]);

    // To assure create & read
    const repo = orm.em.getRepository(Person);
    const toCreate = {
      address: { city: 'city' },
      company: {
        address: { city: 'city-company' },
        address2: { city: 'city-company2' },
        name: 'company',
      },
    };

    repo.create(toCreate);
    await orm.em.flush();

    const [person] = await repo.findAll();
    expect(person).toMatchObject(toCreate);
  });

  it('should have the property prefixed with the one of its parent2', async () => {
    const { fieldNames, orm } = await loadORM(Person, { embeddable: { prefixBehavior: 'relative' } });
    expect(fieldNames).toStrictEqual([
      [ 'address', 'address' ],
      [ 'address_city', 'address_city' ],
      // behavior: relative
      [ 'comp_address_city', 'comp_addr_city' ],
      // behavior: relative (from configuration)
      [ 'comp_address2_city', 'comp_addr2_city' ],
      [ 'company', 'company' ],
      [ 'company_address', 'comp_address' ],
      [ 'company_address2', 'comp_address2' ],
      [ 'company_name', 'comp_name' ],
      [ 'id', 'id' ],
    ]);

    // To assure create & read
    const repo = orm.em.getRepository(Person);
    const toCreate = {
      address: { city: 'city' },
      company: {
        address: { city: 'city-company' },
        address2: { city: 'city-company2' },
        name: 'company',
      },
    };

    repo.create(toCreate);
    await orm.em.flush();

    const [person] = await repo.findAll();
    expect(person).toMatchObject(toCreate);
  });

  it('should create the metadata without conflict', async () => {
    @Entity()
    class PersonWithAddr {

      @PrimaryKey()
      id!: number;

      // To not conflict with `company.address`
      @Embedded(() => Address)
      addr!: Address;

      @Embedded(() => Company)
      company!: Company;

    }

    const { fieldNames, orm } = await loadORM(PersonWithAddr);
    expect(fieldNames).toStrictEqual([
      [ 'addr', 'addr' ],
      [ 'addr_city', 'addr_city' ],
      [ 'company', 'company' ],
      [ 'company_address', 'company_address' ],
      // behavior: relative
      [ 'company_address_city', 'company_addr_city' ],
      [ 'company_address2', 'company_address2' ],
      // behavior: absolute
      [ 'company_address2_city', 'addr2_city' ],
      [ 'company_name', 'company_name' ],
      [ 'id', 'id' ],
    ]);

    // To assure create & read
    const repo = orm.em.getRepository(PersonWithAddr);
    const toCreate = {
      addr: { city: 'city' },
      company: {
        address: { city: 'city-company' },
        address2: { city: 'city-company2' },
        name: 'company',
      },
    };

    repo.create(toCreate);
    await orm.em.flush();

    const [person] = await repo.findAll();
    expect(person).toMatchObject(toCreate);
  });
});
