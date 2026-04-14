export type TaxonomyClass = 'bird' | 'mammal' | 'reptile' | 'amphibian' | 'aquatic' | 'insect' | 'other';

// Checked in order — put more specific categories first to avoid false matches
const AMPHIBIAN_KEYWORDS = [
  'frog', 'toad', 'salamander', 'newt', 'axolotl', 'caecilian', 'treefrog', 'bullfrog',
];

const REPTILE_KEYWORDS = [
  'snake', 'python', 'boa', 'cobra', 'viper', 'rattlesnake', 'mamba', 'anaconda',
  'kingsnake', 'garter', 'corn snake', 'hognose', 'copperhead', 'cottonmouth',
  'lizard', 'gecko', 'iguana', 'chameleon', 'monitor', 'komodo', 'anole', 'skink',
  'gila monster', 'bearded dragon', 'agama', 'basilisk', 'tegu', 'frilled dragon',
  'crocodile', 'alligator', 'caiman', 'gharial', 'gavial',
  'turtle', 'tortoise', 'terrapin', 'sea turtle',
];

const BIRD_KEYWORDS = [
  'eagle', 'hawk', 'falcon', 'osprey', 'kite', 'harrier', 'kestrel', 'merlin',
  'owl', 'barn owl', 'screech owl', 'great horned',
  'parrot', 'macaw', 'cockatoo', 'cockatiel', 'lorikeet', 'parakeet', 'budgie', 'conure', 'lovebird',
  'toucan', 'hornbill', 'woodpecker', 'flicker', 'sapsucker',
  'robin', 'sparrow', 'finch', 'warbler', 'thrush', 'wren', 'nuthatch', 'chickadee',
  'titmouse', 'tit', 'starling', 'mynah', 'myna', 'mockingbird', 'thrasher',
  'hummingbird', 'sunbird', 'honeyeater',
  'heron', 'egret', 'ibis', 'spoonbill', 'stork', 'crane', 'flamingo',
  'duck', 'goose', 'swan', 'teal', 'merganser', 'wigeon', 'pintail', 'mallard',
  'pelican', 'cormorant', 'gannet', 'booby', 'frigatebird', 'puffin', 'albatross', 'petrel', 'shearwater',
  'gull', 'seagull', 'tern', 'skimmer', 'skua',
  'sandpiper', 'plover', 'oystercatcher', 'avocet', 'curlew', 'snipe', 'godwit', 'dunlin',
  'penguin', 'ostrich', 'emu', 'rhea', 'cassowary', 'kiwi',
  'quail', 'pheasant', 'peacock', 'turkey', 'grouse', 'partridge', 'ptarmigan',
  'pigeon', 'dove',
  'jay', 'crow', 'raven', 'magpie', 'jackdaw', 'rook', 'chough',
  'swift', 'swallow', 'martin',
  'lark', 'pipit', 'wagtail', 'shrike', 'vireo', 'tanager', 'grosbeak', 'bunting',
  'oriole', 'blackbird', 'grackle', 'cardinal', 'bluebird', 'goldfinch', 'siskin',
  'flycatcher', 'phoebe', 'kingfisher', 'bee eater', 'roller', 'hoopoe',
  'weaver', 'bishop', 'indigobird', 'whydah',
];

const MAMMAL_KEYWORDS = [
  'lion', 'tiger', 'leopard', 'cheetah', 'jaguar', 'puma', 'cougar', 'lynx', 'bobcat', 'ocelot', 'serval',
  'cat', 'dog', 'wolf', 'coyote', 'fox', 'dingo', 'jackal', 'dhole',
  'bear', 'grizzly', 'polar bear', 'black bear', 'sun bear', 'spectacled bear', 'panda',
  'koala', 'wombat', 'kangaroo', 'wallaby', 'quokka', 'possum', 'opossum', 'bilby', 'bandicoot',
  'tasmanian devil', 'quoll', 'numbat', 'echidna', 'platypus',
  'deer', 'elk', 'moose', 'caribou', 'reindeer', 'roe deer', 'fallow deer', 'muntjac',
  'antelope', 'gazelle', 'impala', 'springbok', 'gemsbok', 'oryx', 'kudu', 'eland', 'wildebeest', 'gnu',
  'zebra', 'horse', 'donkey', 'mule', 'pony',
  'elephant', 'mammoth',
  'rhino', 'rhinoceros', 'hippo', 'hippopotamus',
  'giraffe', 'okapi',
  'monkey', 'ape', 'gorilla', 'chimpanzee', 'bonobo', 'orangutan', 'gibbon',
  'baboon', 'macaque', 'colobus', 'langur', 'tamarin', 'marmoset', 'capuchin', 'spider monkey',
  'lemur', 'aye aye', 'indri', 'sifaka', 'galago', 'bushbaby', 'loris', 'tarsier',
  'rabbit', 'hare', 'pika',
  'squirrel', 'chipmunk', 'prairie dog', 'groundhog', 'marmot', 'beaver', 'capybara',
  'mouse', 'rat', 'vole', 'lemming', 'hamster', 'gerbil', 'guinea pig', 'porcupine',
  'hedgehog', 'tenrec', 'mole', 'shrew',
  'bat', 'flying fox',
  'skunk', 'raccoon', 'coati', 'kinkajou', 'olingo', 'ringtail',
  'otter', 'badger', 'wolverine', 'weasel', 'ferret', 'mink', 'stoat', 'ermine', 'polecat', 'marten',
  'civet', 'genet', 'binturong', 'fossa', 'linsang',
  'hyena', 'aardwolf',
  'mongoose', 'meerkat', 'suricate',
  'sloth', 'anteater', 'armadillo', 'pangolin', 'aardvark',
  'whale', 'dolphin', 'porpoise', 'narwhal', 'beluga',
  'seal', 'sea lion', 'walrus', 'fur seal',
  'manatee', 'dugong',
  'bison', 'buffalo', 'yak', 'muskox', 'gaur', 'banteng', 'takin',
  'goat', 'sheep', 'ibex', 'chamois', 'tahr', 'markhor',
  'pig', 'boar', 'warthog', 'babirusa', 'peccary',
  'camel', 'dromedary', 'llama', 'alpaca', 'vicuna', 'guanaco',
  'tapir', 'pronghorn',
];

const AQUATIC_KEYWORDS = [
  'fish', 'shark', 'ray', 'skate', 'sawfish',
  'salmon', 'trout', 'char', 'grayling',
  'tuna', 'marlin', 'sailfish', 'swordfish', 'mahi', 'dorado', 'wahoo',
  'bass', 'perch', 'pike', 'walleye', 'muskellunge', 'pickerel',
  'cod', 'haddock', 'pollock', 'hake', 'halibut', 'flounder', 'sole', 'turbot',
  'catfish', 'carp', 'barb', 'minnow', 'chub', 'dace', 'roach', 'bream',
  'goldfish', 'koi', 'danio', 'rasbora', 'tetra', 'guppy', 'molly', 'platy', 'swordtail',
  'betta', 'fighting fish', 'discus', 'oscar', 'cichlid', 'tilapia', 'angelfish',
  'clownfish', 'pufferfish', 'triggerfish', 'parrotfish', 'surgeonfish', 'tang',
  'grouper', 'snapper', 'barracuda', 'jack', 'pompano',
  'eel', 'moray', 'electric eel', 'lamprey',
  'seahorse', 'pipefish', 'dragonet', 'goby', 'blenny', 'wrasse',
  'sturgeon', 'paddlefish', 'gar', 'bowfin',
  'herring', 'sardine', 'anchovy', 'sprat', 'shad',
  'mackerel', 'bonito', 'amberjack',
  'loach', 'pleco', 'corydoras',
  'octopus', 'squid', 'cuttlefish', 'nautilus',
  'jellyfish', 'portuguese man', 'box jelly',
  'crab', 'lobster', 'shrimp', 'prawn', 'krill', 'barnacle', 'crayfish',
  'starfish', 'sea star', 'sea urchin', 'sea cucumber', 'brittle star',
  'clam', 'oyster', 'mussel', 'scallop', 'snail', 'abalone',
  'coral', 'sea anemone',
];

const INSECT_KEYWORDS = [
  'butterfly', 'moth', 'skipper',
  'beetle', 'ladybug', 'ladybird', 'firefly', 'lightning bug', 'weevil', 'longhorn', 'scarab',
  'stag beetle', 'click beetle', 'ground beetle', 'tiger beetle', 'diving beetle', 'whirligig',
  'ant', 'army ant', 'carpenter ant', 'fire ant', 'leafcutter ant',
  'bee', 'bumblebee', 'honeybee', 'mason bee', 'sweat bee',
  'wasp', 'hornet', 'yellowjacket', 'mud dauber', 'paper wasp',
  'dragonfly', 'damselfly',
  'grasshopper', 'cricket', 'locust', 'katydid',
  'mantis', 'praying mantis', 'stick insect', 'walkingstick', 'leaf insect',
  'cockroach', 'termite',
  'fly', 'mosquito', 'gnat', 'midge', 'crane fly', 'hoverfly', 'blowfly',
  'cicada', 'leafhopper', 'treehopper', 'planthopper', 'aphid', 'scale insect',
  'earwig', 'stonefly', 'mayfly', 'caddisfly',
  'water strider', 'backswimmer', 'giant water bug',
  'spider', 'tarantula', 'jumping spider', 'wolf spider', 'orb weaver', 'crab spider',
  'funnel web', 'black widow', 'brown recluse', 'trapdoor spider',
  'scorpion', 'whip scorpion', 'pseudoscorpion',
  'tick', 'mite', 'harvest mite',
  'centipede', 'millipede',
];

export function getTaxonomyClass(label: string): TaxonomyClass {
  const lower = label.toLowerCase().replace(/_/g, ' ');

  // Check from most specific to most general to avoid false positives
  if (AMPHIBIAN_KEYWORDS.some((k) => lower.includes(k))) return 'amphibian';
  if (REPTILE_KEYWORDS.some((k) => lower.includes(k))) return 'reptile';
  if (BIRD_KEYWORDS.some((k) => lower.includes(k))) return 'bird';
  if (MAMMAL_KEYWORDS.some((k) => lower.includes(k))) return 'mammal';
  if (AQUATIC_KEYWORDS.some((k) => lower.includes(k))) return 'aquatic';
  if (INSECT_KEYWORDS.some((k) => lower.includes(k))) return 'insect';
  return 'other';
}
