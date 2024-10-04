import { MikroORM } from '@mikro-orm/better-sqlite';
import { BaseEntity, Embeddable, Embedded, Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Embeddable()
class Address {

  @Property()
  city!: string;

}


@Embeddable()
class Company {

  @Property()
  name!: string;

  @Embedded(() => Address, { prefix: 'addr_' })
  address!: Address;

}

@Entity()
class Person extends BaseEntity {

  @PrimaryKey()
  id!: number;

  @Embedded(() => Address)
  address!: Address;

  @Embedded(() => Company, { prefix: 'comp_' })
  company!: Company;

}

describe('GH #TODO', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [Person],
      dbName: ':memory:',
      strict: true,
      validate: true,
      validateRequired: true,
    });

    await orm.schema.createSchema();
  });

  afterAll(() => orm.close(true));
  afterEach(() => orm.em.clear());

  it('should have the property prefixed with the one of its parent', async () => {
    const meta = orm.getMetadata().get(Person);

    const fieldNames = meta.comparableProps
      .map(({ name, fieldNames }) => [name, fieldNames[0]])
      .sort(([a], [b]) => a.localeCompare(b));

    expect(fieldNames).toStrictEqual([
      [ 'address', 'address' ],
      [ 'address_city', 'address_city' ],

      // Currently:
      // [ 'comp_address_city', 'addr_city' ],
      // Expected:
      [ 'comp_address_city', 'comp_addr_city' ],

      [ 'company', 'company' ],
      [ 'company_address', 'comp_address' ],
      [ 'company_name', 'comp_name' ],
      [ 'id', 'id' ],
    ]);
  });


  it('should create the metadata without conflict', async () => {
    @Entity()
    class PersonWithAddr extends BaseEntity {

      @PrimaryKey()
      id!: number;

      @Embedded(() => Address)
      addr!: Address;

      @Embedded(() => Company)
      company!: Company;

    }

    let orm: MikroORM | undefined;
    const loadORM = async () => orm = await MikroORM.init({
      entities: [PersonWithAddr],
      dbName: ':memory:',
      strict: true,
      validate: true,
      validateRequired: true,
    });

    // MetadataError: Duplicate fieldNames are not allowed: Person.company_address.city (fieldName: 'addr_city'), Person.addr.city (fieldName: 'addr_city')
    await expect(loadORM()).resolves.toBeDefined();

    await orm?.close();
  });
});
