/* GYMKDR · the modules, in the order they need each other. Each one hangs its part of the app on the
   shared CH object (as Chalk's scripts did on window.CH), so the order matters: core first. */
import CH from './ch';
import './logic/core';
import './logic/data';
import './logic/engine';
import './logic/importer';
import './logic/cardio';
import './logic/reach';
import './logic/stage';
import './logic/wheel';
import './logic/notify';
import './ui/Icon';
import './screens/setup';
import './screens/session';
import './screens/screens';

// In a browser (the web build, used for testing), the app's state can be read from the console.
if (typeof window !== 'undefined' && typeof document !== 'undefined') window.CH = CH;

export default CH;
