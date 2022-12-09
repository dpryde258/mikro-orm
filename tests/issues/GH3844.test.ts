import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  DateType,
  PrimaryKey,
  Property,
  Enum,
  wrap,
  OneToOne,
  Ref,
  ref,
  IsolationLevel,
} from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';

@Entity()
export class GamePoolEntity {

  @PrimaryKey()
  contract_address!: string;

  @PrimaryKey()
  chain_id!: number;

  @Property()
  rpc_url!: string;

  @Property()
  referral_percents!: number[];

  @Property()
  referral_campaign_id!: number;

  @OneToOne(() => GamePoolScannerEntity, e => e.game_pool, {
    orphanRemoval: true,
    wrappedReference: true,
  })
  scanner!: Ref<GamePoolScannerEntity>;

  @Property({ defaultRaw: 'now()' })
  created_at!: Date;

  @Property({
    onUpdate: () => new Date(),
    defaultRaw: 'now()',
  })
  updated_at!: Date;

}

@Entity()
export class GamePoolScannerEntity {

  @OneToOne(() => GamePoolEntity, e => e.scanner, {
    primary: true,
    owner: true,
    fieldNames: ['contract_address', 'chain_id'],
    wrappedReference: true,
  })
  game_pool!: Ref<GamePoolEntity>;

  @Property()
  start_block!: number;

  @Property({ nullable: true })
  current_block?: number;

  @Property()
  min_confirmations!: number;

  @Property({ defaultRaw: 'now()' })
  created_at!: Date;

  @Property({
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updated_at!: Date;

}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    entities: [GamePoolEntity, GamePoolScannerEntity],
    dbName: `:memory:`,
  });

  await orm.schema.refreshDatabase();
});

afterAll(() => orm.close(true));

test('GH3844', async () => {
  let em = orm.em.fork();

  const gamePool = new GamePoolEntity();
  gamePool.contract_address = '0x22';
  gamePool.chain_id = 5;
  gamePool.rpc_url = 'https://aaa.com';
  gamePool.referral_percents = [10_000];
  gamePool.referral_campaign_id = 10;
  gamePool.created_at = new Date();
  gamePool.updated_at = new Date();

  em.persist(gamePool);

  const gamePoolScanner = new GamePoolScannerEntity();
  gamePoolScanner.created_at = new Date();
  gamePoolScanner.game_pool = ref(gamePool);
  gamePoolScanner.min_confirmations = 15;
  gamePoolScanner.start_block = 1;
  gamePoolScanner.updated_at = new Date();

  em.persist(gamePoolScanner);

  await em.flush();

  em = orm.em.fork();

  await em.begin({ isolationLevel: IsolationLevel.READ_COMMITTED });

  const loadedGamePool = await em.findOne(
    GamePoolEntity,
    {
      contract_address: '0x22',
      chain_id: 5,
    },
    { populate: ['scanner'] },
  );

  const loadGamePoolScanner = await em.findOne(GamePoolScannerEntity, {
    game_pool: {
      contract_address: '0x22',
      chain_id: 5,
    },
  });
});
