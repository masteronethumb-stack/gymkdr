/* GYMKDR · data: muscles, movement patterns, the exercise library and starter plans.
   Counting rule (Pelland et al., Sports Medicine 2026): a set credits its main muscle with 1 set
   and each helping muscle with 0.5. This table is what turns a plain log into a coverage map. */
import CH from '../ch';


// Tracked by default: the 13 a general lifter cares about. Forearms, adductors and lower back are
// counted but not checked until the lifter turns them on (Settings > Muscles).
const MUSCLES = [
  { id: 'chest', name: 'Chest' },
  { id: 'lats', name: 'Lats' },
  { id: 'upperBack', name: 'Upper back' },
  { id: 'frontDelts', name: 'Front delts' },
  { id: 'sideDelts', name: 'Side delts' },
  { id: 'rearDelts', name: 'Rear delts' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'quads', name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'glutes', name: 'Glutes' },
  { id: 'calves', name: 'Calves' },
  { id: 'abs', name: 'Abs' },
  { id: 'forearms', name: 'Forearms', optional: true },
  { id: 'adductors', name: 'Adductors', optional: true },
  { id: 'lowerBack', name: 'Lower back', optional: true },
];

// The seven patterns the weekly review checks over 14 days.
const PATTERNS = [
  { id: 'squat', name: 'Squat' },
  { id: 'hinge', name: 'Hinge' },
  { id: 'hpush', name: 'Horizontal push' },
  { id: 'hpull', name: 'Horizontal pull' },
  { id: 'vpush', name: 'Vertical push' },
  { id: 'vpull', name: 'Vertical pull' },
  { id: 'single', name: 'Single-leg' },
];

// How each kind of kit loads. `start` is the first-time suggestion; steps live in Settings.
const EQUIPMENT = {
  barbell: { name: 'Barbell', start: 20 },
  dumbbell: { name: 'Dumbbell', start: 10 },
  kettlebell: { name: 'Kettlebell', start: 12 },
  machine: { name: 'Machine', long: 'Pin-loaded machine', start: 20 },
  plate: { name: 'Plate-loaded', long: 'Plate-loaded machine', start: 20 },
  smith: { name: 'Smith machine', start: 20 },
  cable: { name: 'Cable', start: 10 },
  bodyweight: { name: 'Bodyweight', start: 0 },
};
// Words import files use for each kind of kit, most specific first.
const EQ_WORD = { barbell: 'barbell', dumbbell: 'dumbbell', kettlebell: 'kettlebell', machine: 'machine', plate: 'plate loaded', smith: 'smith machine', cable: 'cable', bodyweight: 'bodyweight' };

/* Machines are sold in brand lines (Hammer Strength, Life Fitness Insignia, Technogym Selection
   and so on) but are named by the movement. The same weight feels different on different brands,
   so a lifter can tag the machine they use and it keeps its own history ("chestPress@hammer"). */
const BRANDS = [
  ['hammer', 'Hammer Strength'], ['lifefitness', 'Life Fitness'], ['technogym', 'Technogym'], ['matrix', 'Matrix'],
  ['cybex', 'Cybex'], ['precor', 'Precor'], ['nautilus', 'Nautilus'], ['panatta', 'Panatta'], ['gym80', 'Gym80'],
  ['prime', 'Prime'], ['arsenal', 'Arsenal Strength'], ['atlantis', 'Atlantis'], ['other', 'Another brand'],
];
const BRAND = Object.fromEntries(BRANDS);
const BRANDABLE = new Set(['machine', 'plate', 'smith', 'cable']);

/* The library, as families. A family is one movement ("Triceps pushdown"); its variants are the
   ways to load it (rope, straight bar, V bar…) and each variant keeps its own history.
   Every variant: [id, equipment, variant label, full name, import aliases, overrides].
   Overrides change the main or helping muscles where a variant shifts the work (diamond push-ups
   are mostly triceps). `assist` marks machines where more weight means more help. */
const FAMILIES = {};
const EXERCISES = [];
function F(fam, name, main, help, pattern, compound, vars) {
  FAMILIES[fam] = { id: fam, name, main, ids: [] };
  vars.forEach(([id, eq, v, full, aliases, over]) => {
    EXERCISES.push(Object.assign({ id, name: full, eq, v, fam, main, help, pattern, compound, aliases: aliases || [] }, over || {}));
    FAMILIES[fam].ids.push(id);
  });
}

/* ---- chest ---- */
F('benchPress', 'Bench or chest press', 'chest', ['triceps', 'frontDelts'], 'hpush', true, [
  ['bench', 'barbell', 'Barbell bench', 'Bench press', ['bench press barbell', 'flat bench press', 'barbell bench press', 'bench press']],
  ['dbBench', 'dumbbell', 'Dumbbell bench', 'Dumbbell bench press', ['bench press dumbbell', 'flat dumbbell press', 'dumbbell bench press']],
  ['smithBench', 'smith', 'Smith machine bench', 'Smith machine bench press', ['bench press smith machine', 'smith bench press', 'smith machine bench press']],
  ['chestPress', 'machine', 'Seated chest press machine', 'Chest press', ['chest press machine', 'seated chest press', 'chest press', 'machine chest press']],
  ['plateChestPress', 'plate', 'Plate-loaded chest press', 'Plate-loaded chest press', ['iso lateral chest press', 'iso lateral chest press machine', 'chest press plate loaded', 'hammer strength chest press', 'iso lateral bench press']],
  ['floorPress', 'barbell', 'Barbell floor press', 'Floor press', ['floor press barbell', 'floor press']],
  ['dbFloorPress', 'dumbbell', 'Dumbbell floor press', 'Dumbbell floor press', ['floor press dumbbell', 'dumbbell floor press']],
  ['kbFloorPress', 'kettlebell', 'Kettlebell floor press', 'Kettlebell floor press', ['floor press kettlebell', 'kettlebell floor press']],
]);
F('inclinePress', 'Incline press', 'chest', ['frontDelts', 'triceps'], 'hpush', true, [
  ['inclineBench', 'barbell', 'Barbell', 'Incline bench press', ['incline bench press barbell', 'incline barbell bench press', 'incline bench press']],
  ['dbIncline', 'dumbbell', 'Dumbbell', 'Incline dumbbell press', ['incline bench press dumbbell', 'incline press dumbbell', 'incline dumbbell bench press', 'incline dumbbell press']],
  ['smithIncline', 'smith', 'Smith machine', 'Smith machine incline press', ['incline bench press smith machine', 'smith incline press', 'smith machine incline press']],
  ['inclineMachine', 'machine', 'Seated machine', 'Incline chest press', ['incline chest press machine', 'incline chest press']],
  ['plateIncline', 'plate', 'Plate-loaded', 'Plate-loaded incline press', ['iso lateral incline press', 'iso lateral incline press machine', 'incline chest press plate loaded', 'hammer strength incline press']],
  ['landminePress', 'barbell', 'Landmine', 'Landmine press', ['landmine press', 'landmine press barbell']],
]);
F('declinePress', 'Decline press', 'chest', ['triceps', 'frontDelts'], 'hpush', true, [
  ['declineBench', 'barbell', 'Barbell', 'Decline bench press', ['decline bench press barbell', 'decline bench press']],
  ['dbDecline', 'dumbbell', 'Dumbbell', 'Decline dumbbell press', ['decline bench press dumbbell', 'decline dumbbell press']],
  ['smithDecline', 'smith', 'Smith machine', 'Smith machine decline press', ['decline bench press smith machine']],
  ['plateDecline', 'plate', 'Plate-loaded', 'Plate-loaded decline press', ['decline chest press machine', 'iso lateral decline press', 'decline press plate loaded']],
]);
F('pushUps', 'Push-up', 'chest', ['triceps', 'frontDelts'], 'hpush', true, [
  ['pushUp', 'bodyweight', 'Standard', 'Push-up', ['push up', 'pushup', 'push ups', 'push up weighted']],
  ['kneePushUp', 'bodyweight', 'From the knees (easier)', 'Knee push-up', ['knee push up', 'push up knees', 'push up on knees']],
  ['inclinePushUp', 'bodyweight', 'Hands raised (easier)', 'Incline push-up', ['incline push up']],
  ['declinePushUp', 'bodyweight', 'Feet raised (harder)', 'Decline push-up', ['decline push up'], { help: ['frontDelts', 'triceps'] }],
  ['widePushUp', 'bodyweight', 'Wide hands', 'Wide push-up', ['wide push up', 'wide grip push up']],
  ['diamondPushUp', 'bodyweight', 'Diamond, hands together', 'Diamond push-up', ['diamond push up', 'close grip push up'], { main: 'triceps', help: ['chest', 'frontDelts'] }],
  ['archerPushUp', 'bodyweight', 'Archer', 'Archer push-up', ['archer push up']],
  ['ringPushUp', 'bodyweight', 'Rings or straps', 'Ring push-up', ['ring push up', 'trx push up', 'suspension push up']],
]);
F('dips', 'Dip', 'chest', ['triceps', 'frontDelts'], 'hpush', true, [
  ['dip', 'bodyweight', 'Parallel bars', 'Dip', ['chest dip', 'dips', 'triceps dip', 'dip', 'chest dip weighted', 'weighted dip']],
  ['assistedDip', 'machine', 'Assisted machine', 'Assisted dip', ['assisted dip', 'dip assisted', 'chest dip assisted', 'assisted dip machine', 'triceps dip assisted'], { assist: true }],
  ['benchDip', 'bodyweight', 'Bench dip', 'Bench dip', ['bench dip', 'triceps dip bench', 'bench dips'], { main: 'triceps', help: ['chest', 'frontDelts'] }],
  ['dipMachine', 'machine', 'Seated dip machine', 'Seated dip machine', ['seated dip machine', 'triceps dip machine', 'dip machine'], { main: 'triceps', help: ['chest'] }],
  ['plateDip', 'plate', 'Plate-loaded seated dip', 'Plate-loaded dip', ['seated dip plate loaded', 'iso lateral dip'], { main: 'triceps', help: ['chest'] }],
]);
F('chestFly', 'Chest fly', 'chest', ['frontDelts'], null, false, [
  ['cableFly', 'cable', 'Cable, middle pulleys', 'Cable fly', ['cable crossover', 'cable fly crossovers', 'chest fly cable', 'cable chest fly', 'cable fly', 'standing cable fly']],
  ['lowCableFly', 'cable', 'Cable, low to high', 'Low-to-high cable fly', ['low cable fly', 'low to high cable fly', 'low cable crossover', 'cable fly low to high']],
  ['highCableFly', 'cable', 'Cable, high to low', 'High-to-low cable fly', ['high cable fly', 'high to low cable fly', 'cable fly high to low']],
  ['seatedCableFly', 'cable', 'Cable, seated', 'Seated cable fly', ['seated cable fly', 'seated cable chest fly']],
  ['pecDeck', 'machine', 'Pec deck', 'Pec deck', ['chest fly machine', 'butterfly', 'pec deck machine', 'butterfly machine', 'pec deck']],
  ['dbFly', 'dumbbell', 'Dumbbells, flat', 'Dumbbell fly', ['chest fly dumbbell', 'dumbbell fly', 'flat dumbbell fly']],
  ['inclineDbFly', 'dumbbell', 'Dumbbells, incline', 'Incline dumbbell fly', ['incline chest fly dumbbell', 'incline dumbbell fly']],
]);

/* ---- back ---- */
F('pullUps', 'Pull-up or chin-up', 'lats', ['biceps', 'upperBack'], 'vpull', true, [
  ['pullUp', 'bodyweight', 'Pull-up, overhand', 'Pull-up', ['pull up', 'pullup', 'pull up weighted', 'weighted pull up', 'pull ups']],
  ['chinUp', 'bodyweight', 'Chin-up, underhand', 'Chin-up', ['chin up', 'chinup', 'chin up weighted', 'weighted chin up'], { help: ['biceps'] }],
  ['neutralPullUp', 'bodyweight', 'Neutral grip', 'Neutral-grip pull-up', ['neutral grip pull up', 'hammer grip pull up']],
  ['widePullUp', 'bodyweight', 'Wide grip', 'Wide-grip pull-up', ['wide grip pull up', 'wide pull up']],
  ['negativePullUp', 'bodyweight', 'Slow lowering only', 'Negative pull-up', ['negative pull up', 'pull up negative', 'eccentric pull up']],
  ['assistedPullUp', 'machine', 'Assisted machine', 'Assisted pull-up', ['assisted pull up', 'pull up assisted', 'assisted chin up', 'chin up assisted', 'assisted pull up machine'], { assist: true }],
]);
F('pulldown', 'Lat pulldown', 'lats', ['biceps', 'upperBack'], 'vpull', true, [
  ['latPulldown', 'cable', 'Wide bar', 'Lat pulldown', ['lat pulldown cable', 'lat pulldown machine', 'pulldown', 'lat pulldown', 'wide grip lat pulldown', 'lat pulldown wide grip cable', 'lat pulldown wide grip']],
  ['closeGripPulldown', 'cable', 'V handle, close grip', 'Close-grip pulldown', ['close grip lat pulldown', 'lat pulldown close grip cable', 'lat pulldown close grip', 'v bar pulldown', 'close grip pulldown']],
  ['neutralPulldown', 'cable', 'Neutral wide handles', 'Neutral-grip pulldown', ['neutral grip lat pulldown', 'neutral grip pulldown', 'lat pulldown neutral grip']],
  ['reversePulldown', 'cable', 'Straight bar, underhand', 'Underhand pulldown', ['reverse grip lat pulldown', 'underhand lat pulldown', 'lat pulldown underhand cable', 'lat pulldown underhand', 'lat pulldown reverse grip']],
  ['singlePulldown', 'cable', 'Single handle', 'Single-arm pulldown', ['single arm lat pulldown', 'one arm lat pulldown', 'single arm pulldown', 'lat pulldown single arm']],
  ['machinePulldown', 'machine', 'Machine, separate arms', 'Machine pulldown', ['pulldown machine', 'machine pulldown']],
  ['platePulldown', 'plate', 'Plate-loaded', 'Plate-loaded pulldown', ['iso lateral pulldown', 'iso lateral front lat pulldown', 'front lat pulldown plate loaded', 'hammer strength pulldown']],
]);
F('pullover', 'Pullover', 'lats', [], null, false, [
  ['straightArmPulldown', 'cable', 'Cable, straight bar', 'Straight-arm pulldown', ['straight arm pulldown', 'straight arm lat pulldown', 'straight arm pulldown cable', 'cable pullover', 'straight arm cable pulldown']],
  ['ropeStraightArm', 'cable', 'Cable, rope', 'Rope straight-arm pulldown', ['rope straight arm pulldown', 'straight arm pulldown rope']],
  ['dbPullover', 'dumbbell', 'Dumbbell', 'Dumbbell pullover', ['pullover dumbbell', 'dumbbell pullover'], { help: ['chest'] }],
  ['machinePullover', 'machine', 'Machine', 'Pullover machine', ['pullover machine', 'machine pullover']],
]);
F('freeRow', 'Row, free weight', 'upperBack', ['lats', 'biceps', 'rearDelts'], 'hpull', true, [
  ['bbRow', 'barbell', 'Barbell, bent over', 'Barbell row', ['bent over row barbell', 'bent over row', 'barbell row', 'barbell bent over row']],
  ['pendlayRow', 'barbell', 'Barbell, from the floor', 'Pendlay row', ['pendlay row', 'pendlay row barbell']],
  ['tBarRow', 'barbell', 'T-bar or landmine', 'T-bar row', ['t bar row', 'landmine row', 't bar row landmine']],
  ['dbRow', 'dumbbell', 'One-arm dumbbell', 'One-arm dumbbell row', ['dumbbell row', 'bent over one arm row dumbbell', 'single arm dumbbell row', 'one arm dumbbell row'], { main: 'lats', help: ['upperBack', 'biceps'] }],
  ['dbBentRow', 'dumbbell', 'Two dumbbells, bent over', 'Bent-over dumbbell row', ['bent over row dumbbell', 'dumbbell bent over row']],
  ['dbChestRow', 'dumbbell', 'Dumbbells, chest on a bench', 'Chest-supported dumbbell row', ['incline dumbbell row', 'chest supported row dumbbell', 'chest supported dumbbell row', 'incline row dumbbell']],
  ['sealRow', 'barbell', 'Barbell, lying on a bench', 'Seal row', ['seal row', 'seal row barbell']],
  ['kbRow', 'kettlebell', 'One-arm kettlebell', 'Kettlebell row', ['kettlebell row', 'bent over row kettlebell', 'one arm kettlebell row']],
  ['smithRow', 'smith', 'Smith machine', 'Smith machine row', ['bent over row smith machine', 'smith machine row']],
]);
F('cableRows', 'Seated cable row', 'upperBack', ['lats', 'biceps', 'rearDelts'], 'hpull', true, [
  ['cableRow', 'cable', 'V handle', 'Seated cable row', ['seated row cable', 'seated cable row v grip cable', 'seated cable row v grip', 'cable row', 'seated cable row', 'seated row']],
  ['wideCableRow', 'cable', 'Wide bar', 'Wide-grip cable row', ['seated cable row bar grip', 'wide grip cable row', 'seated row wide grip', 'seated cable row wide grip']],
  ['ropeCableRow', 'cable', 'Rope', 'Rope cable row', ['rope cable row', 'seated row rope']],
  ['underhandCableRow', 'cable', 'Straight bar, underhand', 'Underhand cable row', ['underhand cable row', 'reverse grip cable row']],
  ['singleCableRow', 'cable', 'Single handle', 'Single-arm cable row', ['single arm cable row', 'one arm cable row', 'single arm seated row']],
]);
F('machineRows', 'Machine row', 'upperBack', ['lats', 'rearDelts', 'biceps'], 'hpull', true, [
  ['machineRow', 'machine', 'Seated, chest pad', 'Machine row', ['seated row machine', 'chest supported row', 'machine row', 'chest supported row machine']],
  ['plateRow', 'plate', 'Plate-loaded', 'Plate-loaded row', ['iso lateral row', 'iso lateral row machine', 'hammer strength row', 'seated row plate loaded', 'iso lateral seated row']],
  ['tBarMachine', 'plate', 'T-bar, chest pad', 'Chest-supported T-bar row', ['chest supported t bar row', 't bar row machine', 'lying t bar row']],
  ['highRow', 'plate', 'High row', 'High row', ['high row', 'iso lateral high row', 'high row machine'], { main: 'lats', help: ['upperBack', 'biceps'] }],
  ['lowRow', 'plate', 'Low row', 'Low row', ['low row', 'iso lateral low row', 'low row machine']],
]);
F('bodyRows', 'Bodyweight row', 'upperBack', ['lats', 'biceps', 'rearDelts'], 'hpull', true, [
  ['invertedRow', 'bodyweight', 'Under a bar (Smith or rack)', 'Inverted row', ['inverted row', 'bodyweight row', 'australian pull up']],
  ['ringRow', 'bodyweight', 'Rings or straps', 'Ring row', ['ring row', 'trx row', 'suspension row']],
]);
F('shrugs', 'Shrug', 'upperBack', ['forearms'], null, false, [
  ['shrug', 'dumbbell', 'Dumbbells', 'Dumbbell shrug', ['shrug dumbbell', 'dumbbell shrug', 'shrug']],
  ['bbShrug', 'barbell', 'Barbell', 'Barbell shrug', ['shrug barbell', 'barbell shrug']],
  ['trapBarShrug', 'barbell', 'Trap bar', 'Trap bar shrug', ['trap bar shrug', 'shrug trap bar']],
  ['smithShrug', 'smith', 'Smith machine', 'Smith machine shrug', ['shrug smith machine']],
  ['machineShrug', 'plate', 'Shrug machine', 'Shrug machine', ['shrug machine', 'shrug plate loaded']],
  ['kbShrug', 'kettlebell', 'Kettlebells', 'Kettlebell shrug', ['shrug kettlebell']],
]);
F('facePulls', 'Face pull', 'rearDelts', ['upperBack'], null, false, [
  ['facePull', 'cable', 'Rope', 'Face pull', ['face pull cable', 'face pull', 'rope face pull']],
]);
F('rearFlys', 'Reverse fly', 'rearDelts', ['upperBack'], null, false, [
  ['rearFly', 'dumbbell', 'Dumbbells, bent over', 'Reverse fly', ['reverse fly dumbbell', 'rear delt fly', 'bent over reverse fly', 'rear delt fly dumbbell']],
  ['inclineRearFly', 'dumbbell', 'Dumbbells, chest on a bench', 'Chest-supported reverse fly', ['incline reverse fly', 'chest supported reverse fly']],
  ['reversePecDeck', 'machine', 'Reverse pec deck', 'Reverse pec deck', ['reverse fly machine', 'rear delt machine', 'reverse pec deck', 'rear delt fly machine']],
  ['cableRearFly', 'cable', 'Cable', 'Cable reverse fly', ['reverse fly cable', 'cable rear delt fly', 'cable reverse fly']],
]);

/* ---- shoulders ---- */
F('ohPress', 'Overhead press', 'frontDelts', ['triceps', 'sideDelts'], 'vpush', true, [
  ['ohp', 'barbell', 'Barbell, standing', 'Overhead press', ['overhead press barbell', 'strict military press barbell', 'military press', 'shoulder press barbell', 'standing overhead press', 'overhead press']],
  ['seatedOhp', 'barbell', 'Barbell, seated', 'Seated barbell press', ['seated overhead press barbell', 'seated military press', 'seated shoulder press barbell']],
  ['dbOhp', 'dumbbell', 'Dumbbells, seated', 'Seated dumbbell press', ['shoulder press dumbbell', 'seated overhead press dumbbell', 'overhead press dumbbell', 'seated shoulder press dumbbell', 'dumbbell shoulder press']],
  ['standingDbOhp', 'dumbbell', 'Dumbbells, standing', 'Standing dumbbell press', ['standing dumbbell press', 'standing shoulder press dumbbell']],
  ['arnoldPress', 'dumbbell', 'Arnold press', 'Arnold press', ['arnold press dumbbell', 'arnold press']],
  ['kbPress', 'kettlebell', 'Kettlebell', 'Kettlebell press', ['kettlebell press', 'overhead press kettlebell', 'kettlebell shoulder press', 'single arm kettlebell press']],
  ['kbCleanPress', 'kettlebell', 'Kettlebell clean and press', 'Kettlebell clean and press', ['kettlebell clean and press', 'clean and press kettlebell'], { help: ['triceps', 'glutes', 'sideDelts'] }],
  ['smithOhp', 'smith', 'Smith machine', 'Smith machine shoulder press', ['overhead press smith machine', 'smith machine shoulder press', 'shoulder press smith machine']],
  ['shoulderPress', 'machine', 'Seated machine', 'Shoulder press', ['shoulder press machine', 'machine shoulder press', 'seated shoulder press machine']],
  ['plateShoulderPress', 'plate', 'Plate-loaded', 'Plate-loaded shoulder press', ['iso lateral shoulder press', 'iso lateral shoulder press machine', 'hammer strength shoulder press', 'shoulder press plate loaded']],
  ['pushPress', 'barbell', 'Push press', 'Push press', ['push press', 'push press barbell'], { help: ['triceps', 'sideDelts', 'quads'] }],
]);
F('bodyPress', 'Pike or handstand push-up', 'frontDelts', ['triceps', 'sideDelts'], 'vpush', true, [
  ['pikePushUp', 'bodyweight', 'Pike push-up', 'Pike push-up', ['pike push up']],
  ['hspu', 'bodyweight', 'Handstand push-up', 'Handstand push-up', ['handstand push up', 'hspu']],
]);
F('latRaises', 'Lateral raise', 'sideDelts', [], null, false, [
  ['latRaise', 'dumbbell', 'Dumbbells, standing', 'Lateral raise', ['lateral raise dumbbell', 'side lateral raise', 'dumbbell lateral raise', 'lateral raise']],
  ['seatedLatRaise', 'dumbbell', 'Dumbbells, seated', 'Seated lateral raise', ['seated lateral raise', 'seated lateral raise dumbbell']],
  ['cableLatRaise', 'cable', 'Cable, single handle', 'Cable lateral raise', ['lateral raise cable', 'cable lateral raise', 'single arm cable lateral raise']],
  ['machineLatRaise', 'machine', 'Machine', 'Machine lateral raise', ['lateral raise machine', 'machine lateral raise']],
  ['kbLatRaise', 'kettlebell', 'Kettlebells', 'Kettlebell lateral raise', ['lateral raise kettlebell']],
]);
F('uprightRows', 'Upright row', 'sideDelts', ['upperBack'], null, false, [
  ['uprightRow', 'barbell', 'Barbell or EZ bar', 'Upright row', ['upright row barbell', 'upright row', 'ez bar upright row']],
  ['dbUprightRow', 'dumbbell', 'Dumbbells', 'Dumbbell upright row', ['upright row dumbbell']],
  ['cableUprightRow', 'cable', 'Cable, straight bar', 'Cable upright row', ['upright row cable', 'cable upright row']],
  ['kbUprightRow', 'kettlebell', 'Kettlebell', 'Kettlebell upright row', ['upright row kettlebell']],
]);
F('frontRaises', 'Front raise', 'frontDelts', [], null, false, [
  ['frontRaise', 'dumbbell', 'Dumbbells', 'Front raise', ['front raise dumbbell', 'dumbbell front raise', 'front raise']],
  ['cableFrontRaise', 'cable', 'Cable', 'Cable front raise', ['front raise cable', 'cable front raise']],
]);

/* ---- arms ---- */
F('curls', 'Biceps curl', 'biceps', ['forearms'], null, false, [
  ['dbCurl', 'dumbbell', 'Dumbbells, standing', 'Dumbbell curl', ['bicep curl dumbbell', 'dumbbell curl', 'dumbbell bicep curl', 'alternating dumbbell curl', 'bicep curl alternating dumbbell']],
  ['bbCurl', 'barbell', 'Barbell, straight', 'Barbell curl', ['bicep curl barbell', 'barbell curl', 'barbell bicep curl']],
  ['ezCurl', 'barbell', 'EZ bar', 'EZ-bar curl', ['ez bar curl', 'bicep curl ez bar', 'ez bar biceps curl', 'ez curl']],
  ['inclineDbCurl', 'dumbbell', 'Dumbbells, incline bench', 'Incline dumbbell curl', ['incline curl dumbbell', 'incline dumbbell curl', 'incline curl']],
  ['concentrationCurl', 'dumbbell', 'Dumbbell, concentration', 'Concentration curl', ['concentration curl', 'concentration curl dumbbell']],
  ['cableCurl', 'cable', 'Cable, straight bar', 'Cable curl', ['bicep curl cable', 'cable curl', 'cable bicep curl', 'cable curl straight bar']],
  ['cableEzCurl', 'cable', 'Cable, EZ bar', 'Cable EZ-bar curl', ['cable ez bar curl', 'ez bar cable curl']],
  ['singleCableCurl', 'cable', 'Cable, single handle', 'Single-arm cable curl', ['single arm cable curl', 'one arm cable curl']],
  ['bayesianCurl', 'cable', 'Cable, behind the body', 'Bayesian curl', ['bayesian curl', 'bayesian cable curl', 'behind the back cable curl']],
  ['machineCurl', 'machine', 'Machine', 'Machine curl', ['bicep curl machine', 'machine curl', 'biceps curl machine']],
  ['kbCurl', 'kettlebell', 'Kettlebell', 'Kettlebell curl', ['bicep curl kettlebell', 'kettlebell curl']],
]);
F('preacher', 'Preacher curl', 'biceps', ['forearms'], null, false, [
  ['ezPreacher', 'barbell', 'EZ bar', 'Preacher curl', ['preacher curl barbell', 'preacher curl ez bar', 'ez bar preacher curl', 'preacher curl']],
  ['dbPreacher', 'dumbbell', 'Dumbbell', 'Dumbbell preacher curl', ['preacher curl dumbbell', 'dumbbell preacher curl']],
  ['machinePreacher', 'machine', 'Machine', 'Machine preacher curl', ['preacher curl machine', 'machine preacher curl']],
  ['cablePreacher', 'cable', 'Cable', 'Cable preacher curl', ['preacher curl cable', 'cable preacher curl']],
]);
F('hammerCurls', 'Hammer curl', 'biceps', ['forearms'], null, false, [
  ['hammerCurl', 'dumbbell', 'Dumbbells', 'Hammer curl', ['hammer curl dumbbell', 'hammer curl', 'dumbbell hammer curl']],
  ['crossHammer', 'dumbbell', 'Dumbbell, across the body', 'Cross-body hammer curl', ['cross body hammer curl', 'cross body curl']],
  ['ropeHammerCurl', 'cable', 'Cable, rope', 'Rope hammer curl', ['rope hammer curl', 'hammer curl cable', 'cable hammer curl', 'hammer curl rope']],
  ['kbHammerCurl', 'kettlebell', 'Kettlebell', 'Kettlebell hammer curl', ['hammer curl kettlebell']],
]);
F('pushdowns', 'Triceps pushdown', 'triceps', [], null, false, [
  ['pushdown', 'cable', 'Straight bar', 'Straight-bar pushdown', ['triceps pushdown cable straight bar', 'triceps pushdown', 'tricep pushdown', 'straight bar pushdown', 'triceps pushdown straight bar', 'tricep pushdown straight bar']],
  ['ropePushdown', 'cable', 'Rope', 'Rope pushdown', ['triceps rope pushdown', 'rope pushdown', 'tricep rope pushdown', 'triceps pushdown rope', 'triceps pushdown cable rope', 'rope triceps pushdown', 'tricep pushdown rope']],
  ['vBarPushdown', 'cable', 'V bar', 'V-bar pushdown', ['v bar pushdown', 'triceps pushdown v bar', 'triceps pushdown cable v bar', 'v bar triceps pushdown']],
  ['ezPushdown', 'cable', 'EZ bar', 'EZ-bar pushdown', ['ez bar pushdown', 'triceps pushdown ez bar', 'triceps pushdown cable ez bar']],
  ['singlePushdown', 'cable', 'Single handle', 'Single-arm pushdown', ['single arm pushdown', 'single arm triceps pushdown', 'one arm triceps pushdown', 'single arm tricep pushdown', 'triceps pushdown single arm']],
  ['reversePushdown', 'cable', 'Straight bar, underhand', 'Reverse-grip pushdown', ['reverse grip pushdown', 'reverse grip triceps pushdown', 'reverse triceps pushdown', 'triceps pushdown reverse grip']],
  ['machinePushdown', 'machine', 'Machine', 'Triceps machine', ['triceps pushdown machine', 'tricep pushdown machine', 'triceps extension machine', 'triceps press machine', 'seated triceps press machine']],
]);
F('ohExt', 'Overhead triceps extension', 'triceps', [], null, false, [
  ['ohTriExt', 'cable', 'Cable, rope', 'Overhead cable extension', ['triceps extension cable', 'overhead triceps extension cable', 'overhead cable triceps extension', 'overhead rope extension', 'overhead triceps extension rope', 'rope overhead extension', 'overhead triceps extension']],
  ['ohBarExt', 'cable', 'Cable, straight or EZ bar', 'Overhead cable bar extension', ['overhead cable bar extension', 'overhead triceps extension bar']],
  ['singleOhExt', 'cable', 'Cable, single handle', 'One-arm overhead cable extension', ['single arm overhead cable extension', 'single arm overhead triceps extension cable']],
  ['dbTriExt', 'dumbbell', 'Dumbbell, two hands', 'Overhead dumbbell extension', ['triceps extension dumbbell', 'overhead triceps extension dumbbell', 'seated triceps extension dumbbell', 'overhead dumbbell extension']],
  ['singleDbTriExt', 'dumbbell', 'Dumbbell, one arm', 'One-arm overhead extension', ['single arm triceps extension dumbbell', 'one arm overhead extension']],
  ['ezOhExt', 'barbell', 'EZ bar', 'Overhead EZ-bar extension', ['overhead ez bar extension', 'triceps extension ez bar', 'french press']],
  ['kbOhExt', 'kettlebell', 'Kettlebell', 'Overhead kettlebell extension', ['triceps extension kettlebell', 'overhead kettlebell extension']],
]);
F('lyingExt', 'Skull crusher', 'triceps', [], null, false, [
  ['skullCrusher', 'barbell', 'EZ bar or barbell', 'Skull crusher', ['skullcrusher barbell', 'lying triceps extension barbell', 'skull crusher', 'skullcrusher', 'ez bar skull crusher', 'skullcrusher ez bar', 'lying triceps extension']],
  ['dbSkullCrusher', 'dumbbell', 'Dumbbells', 'Dumbbell skull crusher', ['skullcrusher dumbbell', 'lying triceps extension dumbbell', 'dumbbell skull crusher']],
  ['cableSkullCrusher', 'cable', 'Cable', 'Cable skull crusher', ['lying cable triceps extension', 'cable skull crusher']],
]);
F('closePress', 'Close-grip press', 'triceps', ['chest', 'frontDelts'], 'hpush', true, [
  ['closeGrip', 'barbell', 'Barbell', 'Close-grip bench press', ['bench press close grip barbell', 'close grip bench press', 'bench press close grip']],
  ['smithCloseGrip', 'smith', 'Smith machine', 'Smith machine close-grip press', ['close grip bench press smith machine', 'bench press close grip smith machine']],
  ['dbCloseGrip', 'dumbbell', 'Dumbbells pressed together', 'Dumbbell squeeze press', ['close grip dumbbell press', 'dumbbell squeeze press', 'crush press']],
]);
F('kickbacks', 'Triceps kickback', 'triceps', [], null, false, [
  ['dbKickback', 'dumbbell', 'Dumbbell', 'Triceps kickback', ['triceps kickback dumbbell', 'tricep kickback', 'triceps kickback', 'dumbbell kickback']],
  ['cableKickback', 'cable', 'Cable, single handle', 'Cable triceps kickback', ['triceps kickback cable', 'cable triceps kickback']],
]);
F('wristCurls', 'Wrist curl', 'forearms', [], null, false, [
  ['dbWristCurl', 'dumbbell', 'Dumbbell', 'Wrist curl', ['wrist curl dumbbell', 'wrist curl', 'dumbbell wrist curl']],
  ['bbWristCurl', 'barbell', 'Barbell', 'Barbell wrist curl', ['wrist curl barbell', 'barbell wrist curl']],
  ['revWristCurl', 'dumbbell', 'Reverse, dumbbell', 'Reverse wrist curl', ['reverse wrist curl', 'reverse wrist curl dumbbell']],
]);
F('reverseCurls', 'Reverse curl', 'forearms', ['biceps'], null, false, [
  ['reverseCurl', 'barbell', 'EZ bar or barbell', 'Reverse curl', ['reverse curl barbell', 'reverse curl', 'reverse grip curl', 'ez bar reverse curl']],
  ['dbReverseCurl', 'dumbbell', 'Dumbbells', 'Dumbbell reverse curl', ['reverse curl dumbbell']],
  ['cableReverseCurl', 'cable', 'Cable', 'Cable reverse curl', ['reverse curl cable', 'cable reverse curl']],
]);

/* ---- legs ---- */
F('squats', 'Squat', 'quads', ['glutes', 'adductors'], 'squat', true, [
  ['squat', 'barbell', 'Barbell, back', 'Back squat', ['squat barbell', 'back squat barbell', 'squat', 'high bar squat', 'low bar squat', 'back squat', 'barbell squat']],
  ['frontSquat', 'barbell', 'Barbell, front', 'Front squat', ['front squat barbell', 'front squat']],
  ['safetyBarSquat', 'barbell', 'Safety bar', 'Safety bar squat', ['safety bar squat', 'ssb squat', 'safety squat bar squat']],
  ['boxSquat', 'barbell', 'Barbell, to a box', 'Box squat', ['box squat', 'box squat barbell']],
  ['smithSquat', 'smith', 'Smith machine', 'Smith machine squat', ['squat smith machine', 'smith machine squat', 'smith squat']],
  ['gobletSquat', 'dumbbell', 'Dumbbell, goblet', 'Goblet squat', ['goblet squat dumbbell', 'goblet squat', 'dumbbell goblet squat']],
  ['dbSquat', 'dumbbell', 'Dumbbells at your sides', 'Dumbbell squat', ['squat dumbbell', 'dumbbell squat']],
  ['kbGobletSquat', 'kettlebell', 'Kettlebell, goblet', 'Kettlebell goblet squat', ['goblet squat kettlebell', 'kettlebell goblet squat']],
  ['kbFrontSquat', 'kettlebell', 'Two kettlebells, front rack', 'Double kettlebell front squat', ['double kettlebell front squat', 'front squat kettlebell', 'kettlebell front squat']],
  ['airSquat', 'bodyweight', 'Bodyweight', 'Bodyweight squat', ['air squat', 'bodyweight squat', 'squat bodyweight']],
]);
F('machineSquat', 'Machine squat', 'quads', ['glutes', 'adductors'], 'squat', true, [
  ['hackSquat', 'plate', 'Hack squat', 'Hack squat', ['hack squat machine', 'hack squat', 'hack squat plate loaded']],
  ['pendulumSquat', 'plate', 'Pendulum squat', 'Pendulum squat', ['pendulum squat', 'pendulum squat machine']],
  ['beltSquat', 'plate', 'Belt squat', 'Belt squat', ['belt squat', 'belt squat machine']],
  ['vSquat', 'plate', 'V-squat', 'V-squat', ['v squat', 'v squat machine']],
  ['reverseHack', 'plate', 'Reverse hack squat', 'Reverse hack squat', ['reverse hack squat'], { main: 'glutes', help: ['quads', 'hamstrings'] }],
]);
F('legPresses', 'Leg press', 'quads', ['glutes', 'adductors'], 'squat', true, [
  ['legPress', 'plate', '45° sled, plate-loaded', 'Leg press', ['leg press machine', 'leg press', '45 degree leg press', 'leg press plate loaded', 'sled leg press']],
  ['seatedLegPress', 'machine', 'Seated, pin-loaded', 'Seated leg press', ['seated leg press', 'horizontal leg press', 'seated leg press machine']],
  ['singleLegPress', 'plate', 'One leg', 'Single-leg press', ['single leg press', 'single leg leg press', 'one leg press']],
]);
F('legExts', 'Leg extension', 'quads', [], null, false, [
  ['legExt', 'machine', 'Machine, both legs', 'Leg extension', ['leg extension machine', 'leg extension']],
  ['singleLegExt', 'machine', 'Machine, one leg', 'Single-leg extension', ['single leg extension', 'single leg extension machine']],
  ['sissySquat', 'bodyweight', 'Sissy squat (bodyweight)', 'Sissy squat', ['sissy squat']],
  ['reverseNordic', 'bodyweight', 'Reverse Nordic (bodyweight)', 'Reverse Nordic', ['reverse nordic', 'reverse nordic curl']],
]);
F('lunges', 'Lunge', 'quads', ['glutes', 'adductors'], 'single', true, [
  ['lunge', 'dumbbell', 'Dumbbells, walking', 'Walking lunge', ['walking lunge dumbbell', 'lunge dumbbell', 'lunge', 'walking lunge', 'dumbbell lunge']],
  ['reverseLunge', 'dumbbell', 'Dumbbells, stepping back', 'Reverse lunge', ['reverse lunge', 'reverse lunge dumbbell']],
  ['bbLunge', 'barbell', 'Barbell', 'Barbell lunge', ['lunge barbell', 'barbell lunge', 'barbell walking lunge', 'reverse lunge barbell']],
  ['kbLunge', 'kettlebell', 'Kettlebells', 'Kettlebell lunge', ['lunge kettlebell', 'kettlebell lunge', 'kettlebell reverse lunge']],
  ['smithLunge', 'smith', 'Smith machine', 'Smith machine lunge', ['lunge smith machine', 'smith machine reverse lunge']],
  ['bwLunge', 'bodyweight', 'Bodyweight', 'Bodyweight lunge', ['bodyweight lunge', 'lunge bodyweight', 'walking lunge bodyweight']],
]);
F('splitSquats', 'Split squat', 'quads', ['glutes', 'adductors'], 'single', true, [
  ['splitSquat', 'dumbbell', 'Dumbbells, rear foot up', 'Bulgarian split squat', ['bulgarian split squat', 'split squat dumbbell', 'bulgarian split squat dumbbell']],
  ['bbSplitSquat', 'barbell', 'Barbell', 'Barbell split squat', ['split squat barbell', 'bulgarian split squat barbell']],
  ['smithSplitSquat', 'smith', 'Smith machine', 'Smith machine split squat', ['split squat smith machine', 'bulgarian split squat smith machine']],
  ['kbSplitSquat', 'kettlebell', 'Kettlebells', 'Kettlebell split squat', ['split squat kettlebell', 'bulgarian split squat kettlebell']],
  ['bwSplitSquat', 'bodyweight', 'Bodyweight, rear foot up', 'Bodyweight split squat', ['bodyweight bulgarian split squat', 'bulgarian split squat bodyweight', 'split squat bodyweight', 'split squat']],
]);
F('stepUps', 'Step-up', 'quads', ['glutes'], 'single', true, [
  ['stepUp', 'dumbbell', 'Dumbbells', 'Step-up', ['step up dumbbell', 'step up', 'dumbbell step up']],
  ['bbStepUp', 'barbell', 'Barbell', 'Barbell step-up', ['step up barbell']],
  ['kbStepUp', 'kettlebell', 'Kettlebells', 'Kettlebell step-up', ['step up kettlebell']],
  ['bwStepUp', 'bodyweight', 'Bodyweight', 'Bodyweight step-up', ['step up bodyweight', 'bodyweight step up']],
]);
F('pistols', 'Single-leg squat', 'quads', ['glutes'], 'single', true, [
  ['pistolSquat', 'bodyweight', 'Pistol squat', 'Pistol squat', ['pistol squat', 'single leg squat']],
  ['boxPistol', 'bodyweight', 'Pistol to a box', 'Box pistol squat', ['box pistol squat', 'single leg box squat', 'box pistol']],
  ['skaterSquat', 'bodyweight', 'Skater squat', 'Skater squat', ['skater squat']],
  ['kbPistol', 'kettlebell', 'Pistol holding a kettlebell', 'Kettlebell pistol squat', ['kettlebell pistol squat', 'pistol squat kettlebell']],
]);
F('deadlifts', 'Deadlift', 'glutes', ['hamstrings', 'lowerBack', 'quads', 'upperBack'], 'hinge', true, [
  ['deadlift', 'barbell', 'Conventional', 'Deadlift', ['deadlift barbell', 'conventional deadlift', 'deadlift', 'barbell deadlift']],
  ['sumoDeadlift', 'barbell', 'Sumo', 'Sumo deadlift', ['sumo deadlift barbell', 'sumo deadlift'], { help: ['hamstrings', 'adductors', 'quads', 'lowerBack'] }],
  ['trapBar', 'barbell', 'Trap bar', 'Trap bar deadlift', ['trap bar deadlift', 'hex bar deadlift', 'deadlift trap bar']],
  ['rackPull', 'barbell', 'Rack pull', 'Rack pull', ['rack pull', 'rack pull barbell'], { help: ['hamstrings', 'lowerBack', 'upperBack'] }],
  ['dbDeadlift', 'dumbbell', 'Dumbbells', 'Dumbbell deadlift', ['deadlift dumbbell', 'dumbbell deadlift']],
  ['kbDeadlift', 'kettlebell', 'Kettlebell', 'Kettlebell deadlift', ['deadlift kettlebell', 'kettlebell deadlift']],
  ['smithDeadlift', 'smith', 'Smith machine', 'Smith machine deadlift', ['deadlift smith machine']],
]);
F('rdls', 'Romanian deadlift', 'hamstrings', ['glutes', 'lowerBack'], 'hinge', true, [
  ['rdl', 'barbell', 'Barbell', 'Romanian deadlift', ['romanian deadlift barbell', 'rdl', 'romanian deadlift', 'barbell rdl']],
  ['dbRdl', 'dumbbell', 'Dumbbells', 'Dumbbell Romanian deadlift', ['romanian deadlift dumbbell', 'dumbbell rdl']],
  ['kbRdl', 'kettlebell', 'Kettlebell', 'Kettlebell Romanian deadlift', ['romanian deadlift kettlebell', 'kettlebell rdl']],
  ['smithRdl', 'smith', 'Smith machine', 'Smith machine Romanian deadlift', ['romanian deadlift smith machine', 'smith machine rdl']],
  ['stiffLeg', 'barbell', 'Stiff-legged', 'Stiff-legged deadlift', ['stiff legged deadlift barbell', 'stiff legged deadlift', 'stiff leg deadlift']],
  ['singleLegRdl', 'dumbbell', 'One leg, dumbbell', 'Single-leg Romanian deadlift', ['single leg romanian deadlift', 'single leg rdl', 'single leg romanian deadlift dumbbell'], { help: ['glutes'] }],
  ['goodMorning', 'barbell', 'Good morning', 'Good morning', ['good morning', 'good morning barbell']],
  ['cablePullThrough', 'cable', 'Cable pull-through', 'Cable pull-through', ['cable pull through', 'pull through'], { main: 'glutes', help: ['hamstrings'] }],
]);
F('hipThrusts', 'Hip thrust or bridge', 'glutes', ['hamstrings'], 'hinge', true, [
  ['hipThrust', 'barbell', 'Barbell', 'Hip thrust', ['hip thrust barbell', 'glute bridge barbell', 'barbell hip thrust', 'hip thrust']],
  ['hipThrustMachine', 'plate', 'Machine', 'Hip thrust machine', ['hip thrust machine', 'glute drive', 'glute drive machine', 'hip thrust plate loaded']],
  ['smithHipThrust', 'smith', 'Smith machine', 'Smith machine hip thrust', ['hip thrust smith machine']],
  ['dbHipThrust', 'dumbbell', 'Dumbbell', 'Dumbbell hip thrust', ['hip thrust dumbbell']],
  ['gluteBridge', 'bodyweight', 'Glute bridge (bodyweight)', 'Glute bridge', ['glute bridge', 'bodyweight glute bridge', 'hip bridge']],
  ['singleLegBridge', 'bodyweight', 'One-leg bridge (bodyweight)', 'Single-leg glute bridge', ['single leg glute bridge', 'single leg hip thrust', 'single leg bridge']],
]);
F('swings', 'Kettlebell swing', 'glutes', ['hamstrings', 'lowerBack'], 'hinge', true, [
  ['kbSwing', 'kettlebell', 'Two hands', 'Kettlebell swing', ['kettlebell swing', 'russian kettlebell swing', 'american kettlebell swing', 'swing kettlebell']],
  ['kbSwing1', 'kettlebell', 'One arm', 'One-arm kettlebell swing', ['single arm kettlebell swing', 'one arm kettlebell swing']],
  ['dbSwing', 'dumbbell', 'Dumbbell', 'Dumbbell swing', ['dumbbell swing']],
]);
F('cleans', 'Clean', 'glutes', ['hamstrings', 'quads', 'upperBack'], 'hinge', true, [
  ['kbClean', 'kettlebell', 'Kettlebell', 'Kettlebell clean', ['kettlebell clean', 'clean kettlebell']],
  ['dbClean', 'dumbbell', 'Dumbbell', 'Dumbbell clean', ['dumbbell clean', 'clean dumbbell']],
]);
F('snatches', 'Snatch', 'glutes', ['hamstrings', 'upperBack', 'frontDelts'], 'hinge', true, [
  ['kbSnatch', 'kettlebell', 'Kettlebell', 'Kettlebell snatch', ['kettlebell snatch', 'snatch kettlebell']],
  ['dbSnatch', 'dumbbell', 'Dumbbell', 'Dumbbell snatch', ['dumbbell snatch', 'single arm dumbbell snatch']],
]);
F('thrusters', 'Thruster', 'quads', ['glutes', 'frontDelts', 'triceps'], 'squat', true, [
  ['kbThruster', 'kettlebell', 'Kettlebells', 'Kettlebell thruster', ['kettlebell thruster', 'thruster kettlebell']],
  ['dbThruster', 'dumbbell', 'Dumbbells', 'Dumbbell thruster', ['dumbbell thruster', 'thruster dumbbell']],
  ['bbThruster', 'barbell', 'Barbell', 'Barbell thruster', ['thruster barbell', 'thruster', 'barbell thruster']],
]);
F('backExts', 'Back extension', 'lowerBack', ['glutes', 'hamstrings'], 'hinge', true, [
  ['backExt', 'bodyweight', '45° bench', 'Back extension', ['back extension', 'hyperextension', 'back extension hyperextension', '45 degree back extension', 'back extension weighted']],
  ['backExtMachine', 'machine', 'Machine', 'Back extension machine', ['back extension machine', 'lower back machine', 'lumbar extension machine']],
  ['reverseHyper', 'machine', 'Reverse hyper', 'Reverse hyper', ['reverse hyper', 'reverse hyperextension'], { main: 'glutes', help: ['hamstrings', 'lowerBack'] }],
  ['superman', 'bodyweight', 'On the floor', 'Superman', ['superman', 'supermans', 'prone back extension']],
]);
F('legCurls', 'Leg curl', 'hamstrings', [], null, false, [
  ['legCurl', 'machine', 'Lying', 'Lying leg curl', ['lying leg curl machine', 'leg curl', 'lying leg curl', 'prone leg curl']],
  ['seatedLegCurl', 'machine', 'Seated', 'Seated leg curl', ['seated leg curl machine', 'seated leg curl']],
  ['standingLegCurl', 'machine', 'Standing, one leg', 'Standing leg curl', ['standing leg curl', 'standing leg curl machine']],
  ['cableLegCurl', 'cable', 'Cable, ankle strap', 'Cable leg curl', ['cable leg curl', 'standing cable leg curl']],
  ['dbLegCurl', 'dumbbell', 'Dumbbell', 'Dumbbell leg curl', ['leg curl dumbbell', 'dumbbell leg curl']],
  ['nordicCurl', 'bodyweight', 'Nordic (bodyweight)', 'Nordic curl', ['nordic curl', 'nordic hamstring curl', 'nordic ham curl', 'nordic']],
  ['sliderCurl', 'bodyweight', 'Sliders or a towel (bodyweight)', 'Slider leg curl', ['slider leg curl', 'sliding leg curl', 'towel leg curl', 'swiss ball leg curl', 'stability ball leg curl']],
]);
F('abductions', 'Hip abduction', 'glutes', [], null, false, [
  ['abduction', 'machine', 'Machine', 'Hip abduction', ['hip abductor machine', 'hip abduction machine', 'hip abduction', 'abductor machine']],
  ['cableAbduction', 'cable', 'Cable, ankle strap', 'Cable hip abduction', ['cable hip abduction', 'standing cable hip abduction']],
]);
F('gluteKickbacks', 'Glute kickback', 'glutes', ['hamstrings'], null, false, [
  ['cableGluteKick', 'cable', 'Cable, ankle strap', 'Cable glute kickback', ['cable glute kickback', 'glute kickback cable', 'cable kickback glute']],
  ['gluteKickMachine', 'machine', 'Machine', 'Glute kickback machine', ['glute kickback machine', 'glute kickback', 'rear kick machine', 'glute machine']],
]);
F('adductions', 'Hip adduction', 'adductors', [], null, false, [
  ['adduction', 'machine', 'Machine', 'Hip adduction', ['hip adductor machine', 'hip adduction machine', 'hip adduction', 'adductor machine']],
  ['cableAdduction', 'cable', 'Cable, ankle strap', 'Cable hip adduction', ['cable hip adduction', 'standing cable hip adduction']],
]);
F('calfRaises', 'Calf raise', 'calves', [], null, false, [
  ['calfRaise', 'machine', 'Standing machine', 'Standing calf raise', ['standing calf raise machine', 'calf raise', 'standing calf raise', 'calf raise machine']],
  ['seatedCalf', 'plate', 'Seated, plate-loaded', 'Seated calf raise', ['seated calf raise machine', 'seated calf raise plate loaded', 'seated calf raise']],
  ['legPressCalf', 'plate', 'On the leg press', 'Leg press calf raise', ['calf press on leg press', 'leg press calf raise', 'calf press', 'calf press machine']],
  ['smithCalf', 'smith', 'Smith machine', 'Smith machine calf raise', ['calf raise smith machine', 'standing calf raise smith machine', 'smith machine calf raise']],
  ['dbCalf', 'dumbbell', 'Dumbbell', 'Dumbbell calf raise', ['calf raise dumbbell', 'standing calf raise dumbbell', 'single leg calf raise dumbbell']],
  ['bbCalf', 'barbell', 'Barbell', 'Barbell calf raise', ['standing calf raise barbell', 'calf raise barbell']],
  ['bwCalf', 'bodyweight', 'One leg, bodyweight', 'Single-leg calf raise', ['single leg calf raise', 'bodyweight calf raise', 'calf raise bodyweight', 'standing calf raise bodyweight']],
]);

/* ---- core ---- */
F('crunches', 'Crunch', 'abs', [], null, false, [
  ['crunch', 'bodyweight', 'On the floor', 'Crunch', ['crunch', 'crunches', 'sit up', 'situp']],
  ['cableCrunch', 'cable', 'Cable, kneeling with a rope', 'Cable crunch', ['cable crunch', 'crunch cable', 'kneeling cable crunch']],
  ['machineCrunch', 'machine', 'Machine', 'Ab crunch machine', ['crunch machine', 'ab crunch machine', 'abdominal crunch machine', 'machine crunch']],
  ['declineCrunch', 'bodyweight', 'Decline bench', 'Decline crunch', ['decline crunch', 'decline sit up']],
]);
F('legRaises', 'Leg raise', 'abs', [], null, false, [
  ['legRaise', 'bodyweight', 'Hanging from a bar', 'Hanging leg raise', ['hanging leg raise', 'hanging knee raise', 'knee raise hanging']],
  ['captainsChair', 'bodyweight', "Captain's chair", "Captain's chair leg raise", ['captains chair leg raise', 'knee raise captains chair', 'vertical knee raise', 'knee raise parallel bars']],
  ['lyingLegRaise', 'bodyweight', 'Lying on the floor', 'Lying leg raise', ['lying leg raise', 'leg raise', 'lying leg raises']],
]);
F('rollouts', 'Ab wheel rollout', 'abs', [], null, false, [
  ['abWheel', 'bodyweight', 'Ab wheel', 'Ab wheel rollout', ['ab wheel', 'ab wheel rollout', 'ab rollout']],
]);
F('rotation', 'Twist or anti-twist', 'abs', [], null, false, [
  ['woodchop', 'cable', 'Cable woodchop', 'Cable woodchop', ['cable woodchop', 'woodchop cable', 'wood chop']],
  ['pallofPress', 'cable', 'Pallof press', 'Pallof press', ['pallof press', 'pallof press cable']],
  ['russianTwist', 'bodyweight', 'Russian twist', 'Russian twist', ['russian twist', 'russian twist weighted']],
]);
F('getUps', 'Turkish get-up', 'abs', ['frontDelts', 'glutes'], null, true, [
  ['tgu', 'kettlebell', 'Kettlebell', 'Turkish get-up', ['turkish get up', 'kettlebell turkish get up', 'turkish get up kettlebell', 'tgu']],
  ['dbTgu', 'dumbbell', 'Dumbbell', 'Dumbbell Turkish get-up', ['turkish get up dumbbell']],
]);

/* ---- Olympic lifts ----
   The snatch, the clean and the jerk, with their power, hang and pull versions: fast, whole-body
   barbell lifts. They're a group of their own (CH.data.partOf gives 'olympic'), not under a muscle,
   though each still counts towards the muscles it works. Low reps: the lift is a skill, done fresh.
   Power clean and power snatch keep the ids they had under Glutes, so their history carries over. */
const OLY_LIFT = { sets: 5, lo: 2, hi: 3 }, OLY_STRENGTH = { sets: 4, lo: 3, hi: 5 };
function O(fam, name, main, help, pattern, plan, vars) {
  F(fam, name, main, help, pattern, true, vars);
  FAMILIES[fam].oly = true;
  EXERCISES.filter((e) => e.fam === fam).forEach((e) => { e.oly = true; e.plan = e.plan || plan; });
}
O('olySnatch', 'Snatch', 'glutes', ['quads', 'hamstrings', 'upperBack', 'frontDelts'], 'hinge', OLY_LIFT, [
  ['snatch', 'barbell', 'Full (squat) snatch', 'Snatch', ['snatch', 'squat snatch', 'full snatch', 'snatch barbell', 'barbell snatch']],
  ['powerSnatch', 'barbell', 'Power snatch', 'Power snatch', ['power snatch', 'power snatch barbell']],
  ['hangSnatch', 'barbell', 'Hang snatch', 'Hang snatch', ['hang snatch', 'hang squat snatch']],
  ['hangPowerSnatch', 'barbell', 'Hang power snatch', 'Hang power snatch', ['hang power snatch']],
  ['muscleSnatch', 'barbell', 'Muscle snatch', 'Muscle snatch', ['muscle snatch'], { main: 'upperBack', help: ['frontDelts', 'glutes', 'hamstrings'] }],
]);
O('olyClean', 'Clean', 'glutes', ['quads', 'hamstrings', 'upperBack'], 'hinge', OLY_LIFT, [
  ['squatClean', 'barbell', 'Full (squat) clean', 'Clean', ['clean', 'squat clean', 'full clean', 'clean barbell', 'barbell clean']],
  ['powerClean', 'barbell', 'Power clean', 'Power clean', ['power clean', 'power clean barbell']],
  ['hangClean', 'barbell', 'Hang clean', 'Hang clean', ['hang clean', 'hang squat clean']],
  ['hangPowerClean', 'barbell', 'Hang power clean', 'Hang power clean', ['hang power clean']],
]);
O('olyCleanJerk', 'Clean and jerk', 'glutes', ['quads', 'hamstrings', 'upperBack', 'frontDelts', 'triceps'], 'hinge', OLY_LIFT, [
  ['cleanJerk', 'barbell', 'Clean and jerk', 'Clean and jerk', ['clean and jerk', 'clean jerk', 'clean and jerk barbell', 'c and j']],
  ['powerCleanJerk', 'barbell', 'Power clean and jerk', 'Power clean and jerk', ['power clean and jerk', 'power clean jerk']],
]);
O('olyJerk', 'Jerk', 'frontDelts', ['triceps', 'quads', 'glutes'], 'vpush', OLY_LIFT, [
  ['splitJerk', 'barbell', 'Split jerk', 'Split jerk', ['split jerk', 'jerk', 'jerk barbell', 'split jerk barbell']],
  ['pushJerk', 'barbell', 'Push jerk', 'Push jerk', ['push jerk', 'push jerk barbell']],
  ['powerJerk', 'barbell', 'Power jerk', 'Power jerk', ['power jerk']],
]);
O('olyPulls', 'Clean or snatch pull', 'glutes', ['hamstrings', 'upperBack'], 'hinge', OLY_STRENGTH, [
  ['cleanPull', 'barbell', 'Clean pull', 'Clean pull', ['clean pull', 'clean pull barbell']],
  ['snatchPull', 'barbell', 'Snatch pull', 'Snatch pull', ['snatch pull', 'snatch grip pull']],
  ['cleanHighPull', 'barbell', 'Clean high pull', 'Clean high pull', ['clean high pull', 'high pull'], { help: ['hamstrings', 'upperBack', 'sideDelts'] }],
  ['snatchHighPull', 'barbell', 'Snatch high pull', 'Snatch high pull', ['snatch high pull'], { help: ['hamstrings', 'upperBack', 'sideDelts'] }],
  ['cleanDeadlift', 'barbell', 'Clean deadlift', 'Clean deadlift', ['clean deadlift']],
  ['snatchDeadlift', 'barbell', 'Snatch-grip deadlift', 'Snatch-grip deadlift', ['snatch grip deadlift', 'snatch deadlift']],
]);
O('olySquats', 'Overhead squat', 'quads', ['glutes', 'frontDelts', 'abs'], 'squat', OLY_STRENGTH, [
  ['overheadSquat', 'barbell', 'Overhead squat', 'Overhead squat', ['overhead squat', 'overhead squat barbell', 'ohs']],
  ['snatchBalance', 'barbell', 'Snatch balance', 'Snatch balance', ['snatch balance']],
]);

// Compound lifts default to 6–10 reps, accessories to 10–15. The lifter changes either in Plan.
const it = (ex, sets, lo, hi) => {
  const e = EXERCISES.find((x) => x.id === ex);
  return { ex, sets, lo: lo || (e && e.compound ? 6 : 10), hi: hi || (e && e.compound ? 10 : 15) };
};
const PLANS = [
  {
    id: 'fullbody', name: 'Full body', sub: '2 days, alternate them',
    days: [
      { name: 'Full body A', items: [it('squat', 3), it('bench', 3), it('bbRow', 3), it('latRaise', 2), it('pushdown', 2), it('calfRaise', 2)] },
      { name: 'Full body B', items: [it('rdl', 3), it('ohp', 3), it('latPulldown', 3), it('lunge', 2), it('dbCurl', 2), it('cableCrunch', 2)] },
    ],
  },
  {
    id: 'upperlower', name: 'Upper / Lower', sub: '4 days a week',
    days: [
      { name: 'Upper A', items: [it('bench', 3), it('bbRow', 3), it('ohp', 2), it('latPulldown', 2), it('latRaise', 2), it('dbCurl', 2)] },
      { name: 'Lower A', items: [it('squat', 3), it('rdl', 3), it('legPress', 2), it('calfRaise', 3), it('legRaise', 2)] },
      { name: 'Upper B', items: [it('dbIncline', 3), it('pullUp', 3), it('cableRow', 3), it('dbOhp', 2), it('facePull', 2), it('pushdown', 2)] },
      { name: 'Lower B', items: [it('deadlift', 3, 4, 6), it('splitSquat', 3), it('legExt', 2), it('seatedCalf', 3), it('cableCrunch', 2)] },
    ],
  },
  {
    id: 'ppl', name: 'Push / Pull / Legs', sub: '3 or 6 days a week',
    days: [
      { name: 'Push', items: [it('bench', 3), it('ohp', 3), it('dbIncline', 2), it('latRaise', 3), it('pushdown', 2)] },
      { name: 'Pull', items: [it('latPulldown', 3), it('bbRow', 3), it('cableRow', 2), it('facePull', 2), it('dbCurl', 3)] },
      { name: 'Legs', items: [it('squat', 3), it('rdl', 3), it('legPress', 2), it('legCurl', 2), it('calfRaise', 3)] },
    ],
  },
];

/* Routine set-up. A routine is made of movement slots ("Chest press", "Row"); the lifter's
   equipment picks the version of each, and any slot can be swapped for another version later
   (the machine is busy, or they prefer dumbbells). Options are in full-gym order of preference,
   with a kettlebell and a bodyweight version near the end so every kit list has a pick. */
const SLOTS = {
  chestPress: { name: 'Chest press', lo: 6, hi: 10, options: ['bench', 'dbBench', 'chestPress', 'plateChestPress', 'smithBench', 'kbFloorPress', 'pushUp'] },
  inclinePress: { name: 'Incline press', lo: 8, hi: 12, options: ['inclineBench', 'dbIncline', 'inclineMachine', 'plateIncline', 'smithIncline', 'landminePress', 'declinePushUp', 'pushUp'] },
  chestFly: { name: 'Chest fly', lo: 10, hi: 15, options: ['cableFly', 'pecDeck', 'dbFly', 'lowCableFly', 'pushUp', 'widePushUp'] },
  shoulderPress: { name: 'Shoulder press', lo: 6, hi: 10, options: ['ohp', 'dbOhp', 'shoulderPress', 'plateShoulderPress', 'smithOhp', 'kbPress', 'pikePushUp'] },
  sideRaise: { name: 'Side raise', lo: 10, hi: 15, options: ['latRaise', 'cableLatRaise', 'machineLatRaise', 'kbLatRaise', 'uprightRow'] },
  rearDelts: { name: 'Rear delts', lo: 10, hi: 15, options: ['facePull', 'rearFly', 'reversePecDeck', 'cableRearFly', 'kbRow', 'ringRow'] },
  triceps: { name: 'Triceps', lo: 10, hi: 15, options: ['ropePushdown', 'ohTriExt', 'pushdown', 'dbTriExt', 'skullCrusher', 'machinePushdown', 'kbOhExt', 'dip', 'diamondPushUp', 'benchDip', 'closeGrip'] },
  verticalPull: { name: 'Pull-up or pulldown', lo: 6, hi: 10, options: ['pullUp', 'latPulldown', 'assistedPullUp', 'platePulldown', 'chinUp', 'neutralPullUp'] },
  row: { name: 'Row', lo: 8, hi: 12, options: ['bbRow', 'dbRow', 'cableRow', 'machineRow', 'plateRow', 'dbChestRow', 'kbRow', 'invertedRow', 'ringRow'] },
  biceps: { name: 'Biceps curl', lo: 10, hi: 15, options: ['dbCurl', 'bbCurl', 'cableCurl', 'machineCurl', 'hammerCurl', 'ezPreacher', 'kbCurl', 'kbHammerCurl', 'chinUp'] },
  squat: { name: 'Squat', lo: 6, hi: 10, options: ['squat', 'legPress', 'hackSquat', 'smithSquat', 'gobletSquat', 'frontSquat', 'kbGobletSquat', 'kbFrontSquat', 'airSquat'] },
  quadSecond: { name: 'Leg press or squat', lo: 8, hi: 12, options: ['legPress', 'hackSquat', 'pendulumSquat', 'seatedLegPress', 'frontSquat', 'gobletSquat', 'kbGobletSquat', 'splitSquat', 'bwSplitSquat'] },
  hinge: { name: 'Hip hinge', lo: 8, hi: 12, options: ['rdl', 'dbRdl', 'hipThrust', 'hipThrustMachine', 'kbSwing', 'kbRdl', 'singleLegBridge', 'backExt', 'gluteBridge'] },
  deadlift: { name: 'Deadlift', lo: 4, hi: 6, options: ['deadlift', 'trapBar', 'rdl', 'dbRdl', 'kbDeadlift', 'hipThrustMachine', 'singleLegBridge'] },
  singleLeg: { name: 'Lunge or split squat', lo: 8, hi: 12, options: ['splitSquat', 'lunge', 'stepUp', 'smithSplitSquat', 'kbLunge', 'bwSplitSquat', 'bwLunge'] },
  legExt: { name: 'Leg extension', lo: 10, hi: 15, options: ['legExt', 'splitSquat', 'gobletSquat', 'kbGobletSquat', 'sissySquat', 'bwStepUp'] },
  legCurl: { name: 'Leg curl', lo: 10, hi: 15, options: ['legCurl', 'seatedLegCurl', 'dbLegCurl', 'kbSwing', 'nordicCurl', 'sliderCurl'] },
  calves: { name: 'Calves', lo: 10, hi: 15, options: ['calfRaise', 'seatedCalf', 'legPressCalf', 'dbCalf', 'bwCalf'] },
  abs: { name: 'Abs', lo: 10, hi: 15, options: ['cableCrunch', 'legRaise', 'abWheel', 'machineCrunch', 'crunch', 'lyingLegRaise'] },
};

// What the lifter trains with decides which version of each slot they start with.
const PROFILES = [
  { id: 'gym', short: 'Gym', name: 'Full gym', sub: 'Barbells, dumbbells, kettlebells, machines and cables', prefer: ['barbell', 'dumbbell', 'cable', 'machine', 'plate', 'smith', 'bodyweight'], allow: ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'plate', 'smith', 'bodyweight'] },
  { id: 'machines', short: 'Machines', name: 'Mostly machines', sub: 'Machines and cables first, then dumbbells', prefer: ['machine', 'plate', 'cable', 'smith'], allow: ['machine', 'plate', 'cable', 'smith', 'dumbbell', 'bodyweight'] },
  { id: 'home', short: 'Home gym', name: 'Barbell, rack and dumbbells', sub: 'A garage or home gym', prefer: ['barbell', 'dumbbell', 'bodyweight'], allow: ['barbell', 'dumbbell', 'kettlebell', 'bodyweight'] },
  { id: 'dumbbells', short: 'Dumbbells', name: 'Dumbbells and bodyweight', sub: 'A home, hotel or apartment gym', prefer: ['dumbbell', 'bodyweight'], allow: ['dumbbell', 'bodyweight'] },
  { id: 'kettlebells', short: 'Kettlebells', name: 'Kettlebells and bodyweight', sub: 'A few kettlebells, a pull-up bar if you have one', prefer: ['kettlebell'], allow: ['kettlebell', 'bodyweight'] },
  { id: 'bodyweight', short: 'Bodyweight', name: 'Bodyweight only', sub: 'No weights. A pull-up bar and a bench or chair help', prefer: ['bodyweight'], allow: ['bodyweight'] },
];

const s = (slot, sets, lo, hi) => ({ slot, sets, lo, hi });
const ROUTINES = [
  { id: 'fullbody', name: 'Full body', sub: '2 workouts, alternated, 2 or 3 days a week', who: 'Every muscle, every workout. The best start, and the best fit for 2 or 3 days a week.', days: [
    { name: 'Full body A', items: [s('squat', 3), s('chestPress', 3), s('row', 3), s('sideRaise', 2), s('triceps', 2), s('calves', 2)] },
    { name: 'Full body B', items: [s('hinge', 3), s('shoulderPress', 3), s('verticalPull', 3), s('singleLeg', 2), s('biceps', 2), s('abs', 2)] },
  ] },
  { id: 'upperlower', name: 'Upper / Lower', sub: '4 days a week', who: 'Upper body, then legs, twice through. Each muscle twice a week.', days: [
    { name: 'Upper A', items: [s('chestPress', 3), s('row', 3), s('shoulderPress', 2), s('verticalPull', 2), s('sideRaise', 2), s('biceps', 2)] },
    { name: 'Lower A', items: [s('squat', 3), s('hinge', 3), s('quadSecond', 2), s('legCurl', 2), s('calves', 3), s('abs', 2)] },
    { name: 'Upper B', items: [s('inclinePress', 3), s('verticalPull', 3), s('row', 3), s('shoulderPress', 2), s('rearDelts', 2), s('triceps', 2)] },
    { name: 'Lower B', items: [s('deadlift', 3), s('singleLeg', 3), s('legExt', 2), s('legCurl', 2), s('calves', 3), s('abs', 2)] },
  ] },
  { id: 'ppl', name: 'Push / Pull / Legs', sub: '3 days a week, or 6 going round twice', who: 'Chest, shoulders and triceps; then back and biceps; then legs.', days: [
    { name: 'Push', items: [s('chestPress', 3), s('shoulderPress', 3), s('inclinePress', 2), s('sideRaise', 3), s('triceps', 3)] },
    { name: 'Pull', items: [s('verticalPull', 3), s('row', 3), s('row', 2), s('rearDelts', 2), s('biceps', 3)] },
    { name: 'Legs', items: [s('squat', 3), s('hinge', 3), s('legExt', 2), s('legCurl', 2), s('calves', 3)] },
  ] },
  { id: 'split', name: 'Body-part split', sub: '5 days a week, one area a day', who: 'Chest, back, legs, shoulders, arms: one a day, more sets each.', days: [
    { name: 'Chest', items: [s('chestPress', 4), s('inclinePress', 3), s('chestFly', 3), s('abs', 2)] },
    { name: 'Back', items: [s('verticalPull', 4), s('row', 3), s('row', 3), s('rearDelts', 2)] },
    { name: 'Legs', items: [s('squat', 4), s('hinge', 3), s('quadSecond', 3), s('legCurl', 3), s('calves', 3)] },
    { name: 'Shoulders', items: [s('shoulderPress', 4), s('sideRaise', 4), s('rearDelts', 3), s('calves', 3)] },
    { name: 'Arms', items: [s('biceps', 3), s('triceps', 3), s('biceps', 3), s('triceps', 3), s('abs', 2)] },
  ] },
];

/* Body parts: what a lifter thinks in when filling a day. Each groups the muscles the engine
   counts, so an exercise belongs to the part of its main muscle. */
const PARTS = [
  { id: 'chest', name: 'Chest', muscles: ['chest'] },
  { id: 'back', name: 'Back', muscles: ['lats', 'upperBack', 'lowerBack'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['frontDelts', 'sideDelts'] },
  { id: 'reardelts', name: 'Rear delts', muscles: ['rearDelts'] },
  { id: 'biceps', name: 'Biceps', muscles: ['biceps'] },
  { id: 'triceps', name: 'Triceps', muscles: ['triceps'] },
  { id: 'quads', name: 'Quads', muscles: ['quads'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'glutes', name: 'Glutes', muscles: ['glutes', 'adductors'] },
  { id: 'calves', name: 'Calves', muscles: ['calves'] },
  { id: 'abs', name: 'Abs', muscles: ['abs'] },
  { id: 'forearms', name: 'Forearms', muscles: ['forearms'] },
  // Not muscles: Olympic lifts and cardio sit with the body parts so they're added the same way.
  { id: 'olympic', name: 'Olympic lifts', muscles: [] },
  { id: 'cardio', name: 'Cardio', muscles: [] },
];
// The body parts a day of each name is for. A day named something else starts with none.
const DAY_PARTS = {
  Push: ['chest', 'shoulders', 'triceps'],
  Pull: ['back', 'reardelts', 'biceps'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  Lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  'Full body': ['quads', 'chest', 'back', 'shoulders', 'hamstrings'],
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders', 'reardelts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  'Chest and back': ['chest', 'back'],
  'Shoulders and arms': ['shoulders', 'biceps', 'triceps'],
  'Glutes and hamstrings': ['glutes', 'hamstrings'],
  'Quads and calves': ['quads', 'calves'],
  Core: ['abs'],
  Cardio: ['cardio'],
  // Olympic lifting: the lift first, then the strength work that builds it.
  Snatch: ['olympic', 'quads', 'back', 'abs'],
  'Clean and jerk': ['olympic', 'quads', 'shoulders', 'abs'],
  'Squat and pull': ['quads', 'olympic', 'hamstrings', 'abs'],
  'Olympic lifts': ['olympic'],
};
/* How a routine splits the week. Choosing one only names the days and the body parts each is
   for; the lifter fills them in. Descriptions as Gordon set them out (sources: Gymshark, Healthline,
   Andy Baker, VASA Fitness). */
const SPLITS = [
  { id: 'fullbody', name: 'Full body', title: 'Full Body Split', days: ['Full body'],
    how: 'Your whole body, every major muscle group, in every workout.', freq: '2 to 3 days a week, with a rest day between.',
    best: 'Beginners, busy weeks, and raw strength from compound lifts.', eg: 'Classic 3-day routines like Starting Strength, or Monday, Wednesday, Friday full body.' },
  { id: 'ppl', name: 'Push / Pull / Legs', title: 'Push / Pull / Legs', days: ['Push', 'Pull', 'Legs'],
    how: 'Split by movement. Push: chest, shoulders and triceps. Pull: back, rear delts and biceps. Legs: quads, hamstrings, glutes and calves.', freq: '3 days a week (once through) or 6 (twice through).',
    best: 'Intermediate to advanced lifters who want high volume.' },
  { id: 'upperlower', name: 'Upper / Lower', title: 'Upper / Lower Split', days: ['Upper', 'Lower'],
    how: 'Alternates the whole upper body (chest, back, shoulders, arms) with the whole lower body (legs and core).', freq: '4 days a week is best (Upper, Lower, rest, Upper, Lower, rest, rest), from 2 up to 6.',
    best: 'Balanced growth and strength, with 48 hours to recover between sessions.' },
  { id: 'bodypart', name: 'Body-part split', title: 'Body Part Split (the "Bro Split")', days: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
    how: 'One or two muscle groups a session: chest day, back day, shoulder day, arm day, leg day.', freq: '4 to 6 days a week.',
    best: 'Advanced bodybuilders after deep isolation and high volume for each muscle.' },
  { id: 'arnold', name: 'Arnold split', title: 'Arnold Split', days: ['Chest and back', 'Shoulders and arms', 'Legs'],
    how: 'Pairs muscle groups: chest and back, shoulders and arms, then legs. Run twice a week.', freq: '6 days a week.',
    best: 'Advanced lifters with a high work capacity who recover well.' },
  { id: 'hybrid', name: 'Upper / Lower + Push / Pull / Legs', title: 'Combination / Hybrid Split', days: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
    how: 'Blends two formats to fit your week. This one is Upper / Lower plus Push / Pull / Legs (ULPPL).', freq: '5 days a week.',
    best: 'Extra upper-body or weak-point work while still training everything twice a week.' },
  { id: 'olympic', name: 'Olympic lifting', title: 'Olympic Weightlifting', days: ['Snatch', 'Clean and jerk', 'Squat and pull'],
    how: 'Built around the two competition lifts. A snatch day, a clean and jerk day, then a strength day of squats and pulls. Each starts with the lift, while you are fresh.', freq: '3 days a week, up to 5 or 6 for competitive lifters.',
    best: 'Power, speed and athletic strength; learning the snatch and the clean and jerk. Learn them light, ideally with a coach.' },
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const baseId = (id) => { const k = String(id).indexOf('@'); return k > 0 ? String(id).slice(0, k) : String(id); };

// The version of a slot this lifter starts with: their preferred kit first, in the slot's own
// order, skipping anything already in the same workout. Null when nothing fits their kit.
function pickFor(slotId, profile, used) {
  const slot = SLOTS[slotId];
  const opts = slot.options.map((id) => byId.get(id)).filter(Boolean);
  const free = (e) => !used || !used.has(e.id);
  const e = opts.find((x) => free(x) && profile.prefer.includes(x.eq))
    || opts.find((x) => free(x) && profile.allow.includes(x.eq))
    || opts.find((x) => profile.allow.includes(x.eq));
  return e ? e.id : null;
}
// A slot nothing in the kit can do is left out; one that would repeat an exercise already in
// the workout adds its sets to that exercise instead (up to 6).
function buildDays(routine, profile) {
  return routine.days.map((d) => {
    const used = new Set();
    const items = [];
    d.items.forEach((it) => {
      const slot = SLOTS[it.slot];
      const ex = pickFor(it.slot, profile, used);
      if (!ex) return;
      if (used.has(ex)) { const same = items.find((x) => x.ex === ex); same.sets = Math.min(6, same.sets + it.sets); return; }
      used.add(ex);
      items.push({ ex, slot: it.slot, sets: it.sets, lo: it.lo || slot.lo, hi: it.hi || slot.hi });
    });
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: d.name, items };
  });
}

const branded = new Map();
CH.data = {
  MUSCLES, PATTERNS, EQUIPMENT, EQ_WORD, EXERCISES, FAMILIES, PLANS, BRANDS,
  muscle: (id) => MUSCLES.find((m) => m.id === id),
  pattern: (id) => PATTERNS.find((p) => p.id === id),
  eqName: (eq) => (EQUIPMENT[eq] ? EQUIPMENT[eq].name : ''),
  // Library exercises, the lifter's own custom ones, and machines tagged with a brand.
  ex(id) {
    if (byId.has(id)) return byId.get(id);
    if (CH.cardio && CH.cardio.isCardio(id)) return CH.cardio.ex(id);
    const c = CH.store && CH.store.state.custom[id];
    if (c) return c;
    if (branded.has(id)) return branded.get(id);
    const b = baseId(id), slug = String(id).slice(b.length + 1);
    const base = b !== id && (byId.get(b) || (CH.store && CH.store.state.custom[b]));
    if (!base || !BRAND[slug] || !BRANDABLE.has(base.eq)) return null;
    const e = Object.assign({}, base, { id, base: base.id, brand: slug, brandName: BRAND[slug], name: `${base.name} · ${BRAND[slug]}`, aliases: [] });
    branded.set(id, e);
    return e;
  },
  baseId,
  brandable: (e) => !!(e && BRANDABLE.has(e.eq)),
  all() { return EXERCISES.concat(Object.values((CH.store && CH.store.state.custom) || {})); },
  item: it,
  defaultTracked: () => MUSCLES.filter((m) => !m.optional).map((m) => m.id),
  SLOTS, PROFILES, ROUTINES, pickFor, buildDays, PARTS, DAY_PARTS, SPLITS,
  part: (id) => PARTS.find((p) => p.id === id) || null,
  // The body part an exercise counts towards, by its main muscle.
  partOf(exId) { const e = this.ex(exId); if (e && e.cardio) return 'cardio'; if (e && e.oly) return 'olympic'; return e && e.main ? (PARTS.find((p) => p.muscles.includes(e.main)) || {}).id || null : null; },
  // Everything to choose from for a body part: each movement once, with its versions.
  browsePart(partId) {
    const p = PARTS.find((x) => x.id === partId);
    if (!p) return [];
    const seen = new Set(), out = [];
    // Olympic lifts: their own families in library order, then the lifter's own.
    if (partId === 'olympic') {
      this.all().forEach((e) => {
        if (!e.oly) return;
        const f = e.fam && FAMILIES[e.fam];
        if (!f) { out.push({ ex: e }); return; }
        if (!seen.has(f.id)) { seen.add(f.id); out.push({ fam: f, ids: f.ids.slice() }); }
      });
      return out;
    }
    p.muscles.forEach((m) => this.browse(m).forEach((b) => {
      const k = b.fam ? 'f:' + b.fam.id : 'e:' + b.ex.id;
      if (!seen.has(k)) { seen.add(k); out.push(b); }
    }));
    return out;
  },
  profile: (id) => PROFILES.find((p) => p.id === id) || PROFILES[0],
  // The slot an exercise belongs to, so "swap" can offer its other versions.
  slotFor(exId, hint) {
    if (hint && SLOTS[hint]) return hint;
    const b = baseId(exId);
    const k = Object.keys(SLOTS).find((key) => SLOTS[key].options.includes(b));
    return k || null;
  },
  /* What to browse under a muscle. A family whose main muscle this is shows as one row with all its
     versions; a variant that trains this muscle inside another family (diamond push-ups for
     triceps) shows on its own. Library order, which puts the common ones first. */
  browse(muscle) {
    const fams = [], singles = [], seen = new Set();
    this.all().forEach((e) => {
      // Olympic lifts are browsed as their own group (browsePart('olympic')).
      if (e.main !== muscle || e.oly) return;
      const f = e.fam && FAMILIES[e.fam];
      if (f && f.main === muscle) {
        if (seen.has(f.id)) return;
        seen.add(f.id);
        fams.push({ fam: f, ids: f.ids.slice() });
      } else singles.push({ ex: e });
    });
    return fams.concat(singles);
  },
  family: (id) => FAMILIES[id] || null,
  /* Other ways to do the same thing, best first: the same movement on other kit or handles,
     then the routine slot's options, then anything else for the same muscle and pattern.
     Within each group, kit the lifter has comes first. */
  alternatives(exId, slotId, profile) {
    const ex = this.ex(exId);
    if (!ex) return [];
    const b = ex.base || ex.id;
    const seen = new Set([b, exId]);
    const fits = (e) => !profile || profile.allow.includes(e.eq);
    const out = [];
    const add = (list) => {
      const fresh = list.filter((e) => e && !seen.has(e.id));
      fresh.forEach((e) => seen.add(e.id));
      out.push(...fresh.filter(fits), ...fresh.filter((e) => !fits(e)));
    };
    add(ex.fam && FAMILIES[ex.fam] ? FAMILIES[ex.fam].ids.map((id) => byId.get(id)) : []);
    const k = this.slotFor(b, slotId);
    add(k ? SLOTS[k].options.map((id) => byId.get(id)) : []);
    add(this.all().filter((e) => e.main === ex.main && e.pattern === ex.pattern));
    return out;
  },
};
