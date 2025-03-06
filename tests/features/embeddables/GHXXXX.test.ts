import { Embeddable, Embedded, Entity, Enum, MikroORM, PrimaryKey, Property } from '@mikro-orm/better-sqlite';

enum IpVersion {
  V4 = "v4",
  V6 = "v6"
}

@Embeddable({ abstract: true, discriminatorColumn: "type" })
abstract class IpBase<T extends IpVersion> {

  @Enum(() => IpVersion)
  type!: T;

  @Property()
  ip!: string;

}

@Embeddable({ discriminatorValue: IpVersion.V4 })
class IpV4 extends IpBase<IpVersion.V4> {

  @Property()
  range!: number;

}

@Embeddable({ discriminatorValue: IpVersion.V6 })
class IpV6 extends IpBase<IpVersion.V6> {

  @Property()
  convert!: boolean;

}

enum NetworkType {
  AUTO = "auto",
  MANUAL = "manual"
}

@Embeddable({ abstract: true, discriminatorColumn: "type" })
abstract class NetworkBase<T extends NetworkType> {

  @Enum(() => NetworkType)
  type!: T;

}

@Embeddable({ discriminatorValue: NetworkType.AUTO })
class NetworkAuto extends NetworkBase<NetworkType.AUTO> {

  @Property()
  refresh!: number;

}

@Embeddable({ discriminatorValue: NetworkType.MANUAL })
class NetworkManual extends NetworkBase<NetworkType.MANUAL> {

  @Property()
  dns!: string;

  @Embedded(() => [IpV4, IpV6])
  ip!: IpV4 | IpV4;

}


@Entity()
class Host {

  @PrimaryKey()
  _id!: number;

  @Property()
  name!: string;

  @Embedded(() => [NetworkAuto, NetworkManual])
  network!: NetworkAuto | NetworkManual;

}


describe('GH #XXXX', () => {
  let orm: MikroORM;

  afterEach(async () => {
    if (!orm) {
      return;
    }

    orm.em.clear();
    await orm.close();
  });

  async function loadORM() {
    // and get field names
    orm = await MikroORM.init({
      dbName: ':memory:',
      entities: [Host],
      debug: ["query", "query-params"]
    });
    await orm.schema.createSchema();

    return orm;
  }

  it('should load the nested-nested embeddable', async () => {
    const { em } = await loadORM();

    const created = em.create(Host, {
      name: "test",
      network: {
        type: NetworkType.MANUAL,
        dns: "0.0.0.0",
        ip: { type: IpVersion.V4, ip: "192.168.0.100", range: 24 }
      }
    })
    await em.flush();

    function checkHost(host: Host) {
      const network = host.network as NetworkManual;
      expect(network.type).toBe(NetworkType.MANUAL)
      expect(network.ip).toBeDefined()
      expect(network.dns).toBeDefined()

      const netIp = network.ip as IpV4;
      expect(netIp.type).toBe(IpVersion.V4)
      expect(netIp.ip).toBeDefined()
      expect(netIp.range).toBeDefined()
    }

    // All good
    checkHost(created);

    em.clear();

    // With a cleared em -> load from DB
    const host = await em.findOneOrFail(Host, created._id);
    checkHost(host); // Fails

  });
});
