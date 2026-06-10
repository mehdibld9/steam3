// @ts-nocheck
import { db, usersTable, accountsTable } from "@workspace/db";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

// ── Random generators ──
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const usernames = [
  "SteamKiller", "GhostRider", "CyberNinja", "PixelLord", "VaporWave", "ToxicBot", "NeonFox", "DarkMatter",
  "QuantumLeap", "RetroGamer", "SilentHunter", "IronWolf", "BlazeRunner", "FrostByte", "ShadowStep",
  "DragonSlay", "MysticOrb", "CrimsonKing", "BluePhantom", "TitanFall", "VoidWalker", "NovaStar",
  "PixelPunk", "EchoWraith", "StormBreaker", "NightOwl", "RogueOne", "ZeroCool", "MegaMind", "CosmicRay",
  "ThunderDuck", "LunaWolf", "SolarFlare", "AbyssLord", "NetRunner", "TechMonk", "DataWitch", "GlitchGoblin",
  "PixelBard", "ArcaneBot", "SkyRanger", "SeaDrake", "MossyRock", "FuzzyCat", "BlueBean", "RedFox",
  "GoldenEagle", "SilverWing", "BronzeTank", "PlatinumSage", "EmeraldKnight", "RubyMage", "SapphireRogue",
  "DiamondFist", "AmethystSoul", "ObsidianWing", "JadeSerpent", "OnyxGuard", "CoralReef", "MidnightRaven",
  "DawnStalker", "DuskWalker", "FlameKnight", "IceGuard", "ThunderBear", "WindRider", "EarthShaker",
  "WaterSpirit", "FireSoul", "LightBringer", "DarkBlade", "ShadowHunter", "SpectralWolf", "PhantomFox",
  "GhostWarden", "SpiritWalker", "SoulReaper", "DeathKnight", "LifeGuard", "HopeBearer", "FearSlayer",
  "DreamCatcher", "NightMare", "DayWalker", "StarGazer", "MoonRider", "SunChaser", "CloudRunner",
  "RainMaker", "SnowFaller", "StormCaller", "WindWhisper", "EarthQuaker", "FireStarter", "IceBreaker",
  "RockSmasher", "MetalBender", "WoodCrafter", "GlassCutter", "SandStorm", "DustDevil", "AshWalker",
  "EmberGlow", "SparkFuse", "BoltCrafter", "VoltRunner", "AmpereRush", "WattMaster", "TeslaCoil",
  "EdisonGlow", "FaradayField", "NewtonFall", "EinsteinMind", "HawkingRad", "CurieGlow", "NobelPrize",
  "GalileoStar", "KeplerOrbit", "HubbleLens", "WebbScope", "SaganCosmos", "TysonStar", "NyeScience",
  "MuskRocket", "BezosOrbit", "BransonSky", "AllenDeep", "PageSearch", "ZuckMeta", "DorseyTweet",
  "JobsApple", "WozChip", "GatesWindows", "BallmerBall", "NadellaCloud", "PichaiAI", "SundarSearch",
  "SatyaAzure", "ScottGit", "LinusTux", "TorvaldsKernel", "StallmanFree", "RaymondCat", "ESRHack",
  "KnuthAlgo", "DjikstraPath", "TuringCode", "HopperBug", "LovelaceAda", "BabbageGear", "PascalLoop",
  "CodersParadise", "DevNull", "RootUser", "SudoPower", "AdminRoot", "SysOp", "NetAdmin",
  "WebMaster", "SiteBuilder", "AppMaker", "GameDev", "CodeNinja", "BugHunter", "FeatureCreep",
  "Refactorer", "Debugger", "Compiler", "Interpreter", "Runtime", "Bytecode", "Assembly",
  "HexEditor", "BinaryMind", "BitShift", "ByteArray", "WordSize", "DoubleFloat", "LongLong",
  "ShortInt", "UnsignedChar", "SignedBool", "VoidPointer", "NullRef", "StaticConst", "VolatileAtomic",
  "ThreadSafe", "MutexLock", "Semaphore", "BarrierSync", "CondVar", "SpinLock", "RWLock",
  "Deadlock", "Livelock", "Starvation", "RaceCond", "CacheMiss", "PageFault", "SegFault",
  "StackOver", "HeapUnder", "MemLeak", "BufferOver", "FormatStr", "Injection", "XSSAttack",
  "CSRFToken", "SQLInject", "NoSQLBomb", "DDoSStorm", "MitMProxy", "Sniffer", "Spoofer",
  "Cracker", "Hacker", "Phreaker", "ScriptKid", "WhiteHat", "BlackHat", "GreyHat",
  "RedTeam", "BlueTeam", "PurpleTeam", "GreenTeam", "OrangeTeam", "YellowTeam", "CyanTeam",
  "MagentaOp", "LimeGreen", "TealBlue", "CoralPink", "AquaMarine", "PeachPuff", "LavenderBlush",
  "MintCream", "HoneyDew", "IvoryTower", "LinenCloth", "MistyRose", "AliceBlue", "GhostWhite",
  "SnowFlake", "WhiteSmoke", "Gainsboro", "SilverPlate", "DarkGray", "DimGray", "SlateGray",
  "LightGray", "GrayMatter", "BlackHole", "WhiteDwarf", "RedGiant", "BlueSuper", "YellowMain",
  "BrownDwarf", "OrangeSub", "GreenFlash", "VioletRay", "IndigoInk", "TurquoiseSea", "Aquarium",
  "OceanWave", "RiverFlow", "LakeMirror", "PondRipple", "StreamLine", "BrookBabble", "CreekBed",
  "SpringJump", "WellDeep", "FountainSpray", "Waterfall", "CascadeDrop", "GeyserBurst", "GeyserSteam",
  "GlacierMove", "IcebergTip", "TundraCold", "TaigaPine", "SteppeGrass", "SavannaHeat", "Rainforest",
  "JungleVine", "SwampMoss", "MarshReed", "BogMud", "FenSedge", "MireQuag", "MoorHeather",
  "HeathBell", "MeadowLark", "PastureSheep", "RangeCattle", "PaddockHorse", "CorralPig", "StyPig",
  "BarnOwl", "SiloGrain", "GranaryWheat", "MillStone", "ForgeHammer", "AnvilRing", "BellowsWind",
  "CrucibleHeat", "SmeltOre", "CastMold", "WeldSpark", "SolderJoint", "BrazeBrass", "PlumbLead",
  "TinCan", "CopperWire", "SilverCoin", "GoldBar", "IronFist", "SteelWill", "TitaniumHeart",
  "AluminumWing", "MagnesiumFlare", "CalciumBone", "PotassiumBurst", "SodiumPop", "LithiumCell",
  "CobaltBlue", "NickelDime", "ZincGalv", "MercuryRise", "LeadWeight", "ArsenicTaste", "RadonGlow",
  "UraniumCore", "PlutoniumRod", "ThoriumHammer", "Neptunium", "Americium", "Curium", "Berkelium",
  "Californium", "Einsteinium", "Fermium", "Mendelevium", "Nobelium", "Lawrencium", "Rutherfordium",
  "Dubnium", "Seaborgium", "Bohrium", "Hassium", "Meitnerium", "Darmstadtium", "Roentgenium",
  "Copernicium", "Nihonium", "Flerovium", "Moscovium", "Livermorium", "Tennessine", "Oganesson",
];

const games = [
  "Counter-Strike 2", "Dota 2", "Rust", "GTA V", "Elden Ring", "Valorant", "Apex Legends", "Fortnite",
  "Cyberpunk 2077", "The Witcher 3", "Red Dead Redemption 2", "Hades", "Hollow Knight", "Celeste", "Stardew Valley",
  "Terraria", "Minecraft", "Skyrim", "Fallout 4", "Dark Souls III", "Sekiro", "Baldur's Gate 3",
  "Starfield", "Hogwarts Legacy", "Spider-Man", "God of War", "Horizon Zero Dawn", "Ghost of Tsushima",
  "Death Stranding", "Resident Evil 4", "Doom Eternal", "Half-Life Alyx", "Portal 2", "Team Fortress 2",
  "Left 4 Dead 2", "Payday 3", "Warframe", "Destiny 2", "Rainbow Six Siege", "Overwatch 2", "PUBG",
  "ARK: Survival Evolved", "No Man's Sky", "Subnautica", "Factorio", "Satisfactory", "Deep Rock Galactic",
  "Dead by Daylight", "Phasmophobia", "Among Us", "The Forest", "DayZ", "Escape from Tarkov", "Sea of Thieves",
  "Forza Horizon 5", "Euro Truck Simulator 2", "Cities: Skylines", "Planet Zoo", "Crusader Kings III",
  "Civilization VI", "Total War: Warhammer III", "Stellaris", "XCOM 2", "Into the Breach", "Slay the Spire",
  "Inscryption", "Neon White", "Katana ZERO", "Ori and the Will of the Wisps", "Ori and the Blind Forest",
  "Gris", "Journey", "ABZU", "Firewatch", "Outer Wilds", "Subnautica: Below Zero", "Astroneer",
  "The Long Dark", "Green Hell", "Raft", "Valheim", "V Rising", "Core Keeper", "Terraria",
  "Starbound", "Spelunky 2", "Risk of Rain 2", "Returnal", "Ratchet & Clank", "It Takes Two", "Unravel Two",
  "Cuphead", "Shovel Knight", "Hollow Knight", "Ori and the Will of the Wisps", "Celeste", "Hades",
  "Hyper Light Drifter", "A Short Hike", "Unpacking", "Dorfromantik", "Townscaper", "PowerWash Simulator",
  "Satisfactory", "Factorio", "Shapez", "Dyson Sphere Program", "Mindustry", "InfraSpace",
];

const accountTitles = [
  "Ultimate RPG Collection", "FPS Pro Bundle", "Open World Explorer", "Indie Gems Pack", "Horror Night Pack",
  "Strategy Master Set", "Survival Essentials", "Racing Fan Collection", "Multiplayer Madness", "Story Rich Bundle",
  "Sandbox Paradise", "Co-op Heaven", "Retro Classics", "Sci-Fi Universe", "Fantasy Realm",
  "Sports Legends Pack", "Simulation Suite", "Action Hero Bundle", "Stealth Ops Collection", "Battle Royale Set",
  "MMO Starter Pack", "Puzzle Pro Bundle", "Platformer Paradise", "Metroidvania Mix", "Roguelike Rampage",
  "Crafting & Building", "Space Explorer", "Underwater Adventure", "Post-Apocalyptic Pack", "Medieval Warfare",
  "Cyber World Access", "Magic & Mystery", "Sports Car Garage", "Zombie Survival Kit", "Wild West Collection",
  "Pirate's Treasure", "Ninja Arsenal", "Samurai Soul", "Viking Saga", "Knight's Quest",
  "Dragon Hoard", "Phoenix Rebirth", "Unicorn Stable", "Griffin Nest", "Manticore Den",
  "Kraken's Depth", "Leviathan's Lair", "Titan's Vault", "Golem's Forge", "Gargoyle's Perch",
  "Werewolf Pack", "Vampire Court", "Zombie Horde", "Ghost Manor", "Spectral Realm",
  "Demon's Domain", "Angel's Archive", "Fae Forest", "Shadow Realm", "Crystal Cavern",
  "Amber Mine", "Obsidian Fortress", "Sapphire Tower", "Ruby Citadel", "Emerald Keep",
  "Diamond Palace", "Gold Mine", "Silver Stream", "Bronze Arena", "Platinum Club",
  "Titanium Vault", "Neon District", "Chrome City", "Silicon Valley", "Quantum Lab",
  "Fusion Reactor", "Warp Gate", "Starship Hangar", "Moon Base", "Mars Colony",
  "Titan Station", "Europa Outpost", "Io Mining", "Ganymede Labs", "Callisto Base",
  "Kuiper Belt", "Oort Cloud", "Nebula Nursery", "Galaxy Core", "Black Hole",
  "Supernova", "Pulsar", "Quasar", "Wormhole", "Event Horizon",
  "Dark Matter", "Anti-Matter", "Strange Matter", "Neutron Star", "White Dwarf",
];

const accountDescs = [
  "A massive collection of the finest RPG titles spanning decades of gaming excellence.",
  "Get the edge in competitive shooters with this curated FPS bundle.",
  "Explore vast open worlds with no limits. Your adventure starts here.",
  "Hand-picked indie masterpieces that redefine what games can be.",
  "Sleep is overrated. Dive into the most terrifying horror experiences.",
  "Command armies, build empires, and outsmart your opponents.",
  "Everything you need to survive in the harshest environments.",
  "For the speed demon. The best racing games in one place.",
  "Round up your friends — this multiplayer bundle never gets old.",
  "Games that make you feel something. Deep stories, unforgettable moments.",
  "Build, create, and let your imagination run wild.",
  "The best co-op experiences for you and your crew.",
  "A nostalgic trip through the golden age of gaming.",
  "Explore the cosmos and beyond with this sci-fi collection.",
  "Swords, spells, and dragons. The ultimate fantasy package.",
  "Score goals, hit home runs, and break records.",
  "Live another life. The best simulation experiences available.",
  "Explosions, chases, and epic set pieces. Pure action.",
  "Move in silence. The ultimate stealth and espionage bundle.",
  "Drop in, gear up, and be the last one standing.",
  "Begin your MMO journey with the best starter titles.",
  "Brain-bending puzzles that will keep you up all night.",
  "Jump, dash, and wall-run through the best platformers.",
  "A carefully curated selection of Metroidvania classics.",
  "Die, learn, repeat. The roguelike experience perfected.",
  "Gather resources, craft tools, and build your world.",
  "Boldly go where no gamer has gone before.",
  "Explore the depths of the ocean and discover its secrets.",
  "Scavenge, survive, and rebuild in a broken world.",
  "Siege castles, lead cavalry charges, and conquer kingdoms.",
  "Hack, slash, and upgrade in a neon-drenched cyberpunk world.",
  "Master the arcane arts and uncover ancient mysteries.",
  "The ultimate garage for car enthusiasts.",
  "Weapons, ammo, and nerves of steel. Survive the apocalypse.",
  "Saddle up and ride into the sunset.",
  "X marks the spot. Find the treasure before your rivals.",
  "Silent but deadly. The ninja's arsenal.",
  "Honor, discipline, and the way of the blade.",
  "Raid, conquer, and feast in Valhalla.",
  "Quests, dungeons, and legendary loot await.",
  "A dragon's treasure trove of gaming gold.",
  "Rise from the ashes with this legendary collection.",
  "Magical, mystical, and utterly enchanting.",
  "Rare and majestic. A collector's dream.",
  "Fierce and formidable. Enter if you dare.",
  "From the depths of the ocean comes unimaginable power.",
  "An ancient leviathan's lair of legendary titles.",
  "The vault of the gods. Unmatched in scope.",
  "Forged in fire, built to last. A solid collection.",
  "Perched high above, watching over the gaming world.",
  "A pack of wild, untamed experiences.",
  "Elegant and deadly. The aristocrat's choice.",
  "An unstoppable horde of entertainment.",
  "Haunted by the best games ever made.",
  "A realm of spirits and shadows.",
  "Infernal power at your fingertips.",
  "Heavenly selections for the discerning gamer.",
  "Whimsical and wonderful. A magical collection.",
  "Where light fears to tread.",
  "Hidden gems waiting to be discovered.",
  "Amber-encased classics preserved for eternity.",
  "Impenetrable and imposing. The fortress of gaming.",
  "Rising high above the rest.",
  "A fortress of red-hot entertainment.",
  "A verdant vault of green goodness.",
  "The crown jewel of any collection.",
  "Strike it rich with this golden bundle.",
  "A flowing stream of silver-screen hits.",
  "Battle-tested and proven in the arena.",
  "Exclusive access to the elite.",
  "Unbreakable and unstoppable.",
  "Where the neon never dies.",
  "A gleaming metropolis of gaming.",
  "The heart of innovation.",
  "Where science meets entertainment.",
  "Powering the future of gaming.",
  "Your gateway to the stars.",
  "A fleet of the finest starships.",
  "Humanity's first foothold beyond Earth.",
  "The red planet awaits.",
  "Orbiting the ringed giant.",
  "Beneath the ice of Europa.",
  "Mining the volcanic moon.",
  "Science on the largest moon.",
  "The outermost outpost.",
  "Beyond the planets, into the deep.",
  "The edge of the solar system.",
  "Where stars are born.",
  "The heart of the Milky Way.",
  "Nothing escapes its pull.",
  "The death of a star, the birth of legend.",
  "A beacon in the cosmic dark.",
  "Brighter than a trillion suns.",
  "A shortcut through spacetime.",
  "The point of no return.",
  "The invisible scaffolding of the universe.",
  "The opposite of everything.",
  "The stuff of neutron stars.",
  "Dense, hot, and fascinating.",
  "The cooling embers of stellar fire.",
];

const badgeNames = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Sapphire", "Ruby", "Amethyst", "Obsidian",
  "Titan", "Legend", "Master", "Grandmaster", "Challenger", "Immortal", "Eternal", "Divine", "Mythic", "Cosmic",
];

async function seedUsers(count = 100) {
  const passwordHash = await bcrypt.hash("password123", 10);

  const existingRows = await db.select({ username: usersTable.username }).from(usersTable);
  const existingUsernames = new Set(existingRows.map((r) => r.username));
  let maxSuffix = 0;
  for (const u of existingRows) {
    const m = u.username.match(/_(\d+)$/);
    if (m) maxSuffix = Math.max(maxSuffix, parseInt(m[1], 10));
  }

  const userData: any[] = [];

  for (let i = 0; i < count; i++) {
    const base = pick(usernames);
    const suffix = maxSuffix + i + 1;
    const username = `${base}_${suffix}`;

    const xp = randInt(0, 5000);
    const level = Math.floor(xp / 100) + 1;
    const badge = level >= 15 ? pick(badgeNames) : null;
    const points = randInt(50, 3000);
    const isBanned = Math.random() < 0.05;

    userData.push({
      username,
      displayName: username,
      email: `${username.toLowerCase()}${randInt(1, 999)}@example.com`,
      passwordHash,
      points,
      xp,
      level,
      badgeName: badge,
      isAdmin: false,
      isModerator: false,
      isBanned,
      banReason: isBanned ? "Violation of community guidelines" : null,
      banExpiresAt: isBanned ? new Date(Date.now() + randInt(1, 168) * 60 * 60 * 1000) : null,
      registrationIp: `192.168.${randInt(1, 255)}.${randInt(1, 255)}`,
    });
  }

  await db.insert(usersTable).values(userData);
  console.log(`Inserted ${userData.length} users.`);
}

async function seedAccounts(extraCount = 40) {
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
  if (allUsers.length === 0) {
    console.log("No users found. Seed users first.");
    return;
  }

  const existing = await db.select({ count: sql`count(*)` }).from(accountsTable);
  const existingCount = Number(existing[0]?.count ?? 0);

  const accountCount = extraCount;
  const accountData: any[] = [];
  const usedTitles = new Set<string>();

  // Get existing titles to avoid duplicates
  const existingTitles = await db.select({ title: accountsTable.title }).from(accountsTable);
  for (const t of existingTitles) usedTitles.add(t.title);

  for (let i = 0; i < accountCount; i++) {
    let title: string;
    do { title = pick(accountTitles); } while (usedTitles.has(title));
    usedTitles.add(title);

    const userId = pick(allUsers).id;
    const numGames = randInt(3, 15);
    const accountGames: string[] = [];
    const usedGames = new Set<string>();
    for (let g = 0; g < numGames; g++) {
      let game: string;
      do { game = pick(games); } while (usedGames.has(game));
      usedGames.add(game);
      accountGames.push(game);
    }

    const pointsCost = randInt(50, 800);
    const isAvailable = Math.random() < 0.85;
    const likesCount = randInt(0, 250);
    const claimsCount = isAvailable ? randInt(0, 50) : randInt(50, 200);
    const workingVotes = randInt(0, 100);
    const notWorkingVotes = randInt(0, 30);
    const viewCount = randInt(10, 5000);
    const status = Math.random() < 0.9 ? "approved" : pick(["pending", "rejected"]);
    const unlockMethod = pick(["login", "family", "gift"]);

    accountData.push({
      userId,
      title,
      description: pick(accountDescs),
      games: accountGames,
      pointsCost,
      steamUsername: `steam_${randInt(10000, 99999)}`,
      steamPassword: `pass_${randInt(100000, 999999)}`,
      isAvailable,
      likesCount,
      claimsCount,
      workingVotes,
      notWorkingVotes,
      viewCount,
      unlockMethod,
      status,
      reviewNote: status === "rejected" ? "Account credentials did not verify" : null,
    });
  }

  await db.insert(accountsTable).values(accountData);
  console.log(`Inserted ${accountCount} accounts. Total now: ${existingCount + accountCount}.`);
}

async function main() {
  console.log("Seeding database...");
  await seedUsers(100);
  await seedAccounts(60);
  console.log("Done!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
