import Settings from './utils/settings.js';
import Lib from './lib.js';
import DisplayObject from './components/display-object.js';
import Container from './components/container.js';
import DSprite from './components/sprite.js';
import Scene from './components/scene.js';
import call from './utils/call.js';
import Preloader from "./utils/preloader.js";
import L from "./utils/l.js";

window.Scene = Scene;
window.DSprite = DSprite;
window.Lib = Lib;
window.L = L;

PIXI.settings.MIPMAP_TEXTURES = false;

let stage;
let app;

const FRAME_PERIOD = 1.0;
let frameCounterTime = 0;

let modals = [];
let hiddingModals = [];

let SHOOTTIME = false;
let currentFader;
let showStack = [];
let scale = 1;

class Game {
	
	constructor(gameId) {
		this.settings = new Settings(gameId);
		this.updateGlobal = this.updateGlobal.bind(this);
		this.mouse = new PIXI.Point();
		this.call = call;
		window.addEventListener('mousemove', mouseHandlerGlobal);
		window.game = this;
		
		Object.defineProperties(this, {
			W: {
				enumerable: true,
				get: function() {
					return W;
				}
			},
			H: {
				enumerable: true,
				get: function() {
					return H;
				}
			},
			scale: {
				enumerable: true,
				get: function() {
					return scale;
				}
			},
			currentContainer: {
				enumerable: true,
				get: function() {
					if(modals.length > 0) {
						return modals[modals.length - 1]; //top modal is active
					}
					return this.currentScene; //current scene is active if no modals on screen
				}
			},
			modalsCount: {
				enumerable: true,
				get: function() {
					return modals.length;
				}
			}
			
		});
		
		
	}
	
	
	
	init(element) {
		
		let w = window.innerWidth;
		let h = window.innerHeight;
		scale = Math.min(w / W, h / H);
		/// #if EDITOR
		w = W;
		h = H;
		scale = 1;
		/// #endif
		
		w /= scale;
		h /= scale;
		
		PIXI.settings.RESOLUTION = scale;
		app = new PIXI.Application(w, h, {backgroundColor: 0}); //antialias, forceFXAA
		this.pixiApp = app;
		(element || document.body).appendChild(app.view);
		
		stage = new PIXI.Container();
		stage.name = 'stage';
		this.stage = stage;
		game.stage.scale.x = w / W;
		game.stage.scale.y = h / H;
		
		app.stage.addChild(stage);
		
		app.ticker.add(this.updateGlobal);

/// #if EDITOR
		return;

/// #else
		this._startGame();
/// #endif
	}
	
	faderShoot() {
		assert(currentFader, "game.faderShoot() called without fader on screen");
		SHOOTTIME = true;
		
		while(modals.length > 0) {
			modals.pop().remove();
		}
		this.currentScene.onHide();
		
		if(!this.currentScene.isStatic && (showStack.indexOf(this.currentScene) < 0)) {
			this.currentScene.remove();
		} else {
			this.currentScene.detachFromParent();
		}
		this._setCurrentSceneContent(showStack.pop());
		this._processOnShow();
		
		//TODO: wait until scene's assetw will beloaded
		currentFader.gotoLabelRecursive('hide fader');
		
		SHOOTTIME = false;
	}
	
	_startGame() {
		///#if EDITOR
		throw('game._startGame is for internal usage only. Will be invoked automaticly in production build.');
		///#endif
		
		window.addEventListener('resize', function() {
			let w = window.innerWidth / scale;
			let h = window.innerHeight / scale;
			game.stage.scale.x = w / W;
			game.stage.scale.y = h / H;
			game.pixiApp.renderer.resize(w, h);
		});
		
		let preloader = new Preloader();
		
		fetch("assets.json").then(function(response) {
			return response.json();
		}).then((assets) => {
			
			Lib._setPrefabs(assets.prefabs);
			Lib._setScenes(assets.scenes);
			
			Lib.addTexture('EMPTY', PIXI.Texture.EMPTY);
			Lib.addTexture('WHITE', PIXI.Texture.WHITE);
			
			assets.images.some((tName) => {
				let fileName = 'img/' + tName;
				PIXI.loader.add(fileName);
				Lib.addTexture(tName, fileName);
			});
			PIXI.loader.load();
			preloader.start(() => {
				this.showScene('main');
			});
		});
	}
	
	_processOnShow() {
		this.currentScene.onShow();
	}
	
	
	_setCurrentSceneContent(scene) {
		assert(!this.currentScene || !this.currentScene.parent, "Previous scene was not removed before setting new one.");
		this.currentScene = scene;
		stage.addChildAt(scene, 0);
		/// #if EDITOR
		__getNodeExtendData(game.currentScene).toggled = true;
		editor.refreshTreeViewAndPropertyEditor();
		/// #endif
	}
	
	static get disableAllButtons() {
		return currentFader != null;
	}
	
	faderEnd() {
		assert(currentFader, "game.faderEnd() called without fader on screen");
		currentFader.remove();
		currentFader = null;
		/// #if EDITOR
		editor.refreshTreeViewAndPropertyEditor();
		/// #endif
	}
	
	showScene(scene, faderType) {
		if(typeof scene === 'string') {
			scene = Lib.loadScene(scene);
		}
/// #if EDITOR
		assert(scene instanceof Scene, 'Scene instance expected.');
/// #endif
		if(this.__EDITORmode) {
			if(this.currentScene) {
				stage.removeChild(this.currentScene);
			}
			this._setCurrentSceneContent(scene);
		} else {
			
			
			if(this.currentScene) {
				if(!this.currentScene.isNoStackable) {
					showStack.push(this.currentScene);
				}
				showStack.push(scene);
				this.closeCurrentScene(faderType);
			} else {
				this._setCurrentSceneContent(scene);
			}
			/// #if EDITOR
			editor.refreshTreeViewAndPropertyEditor();
			/// #endif
		}
		
	}
	
	closeCurrentScene(faderType) {
		assert(showStack.length > 0, "can't close latest scene");
		
		if(SHOOTTIME) {
			this.faderShoot();
		} else {
			if(!faderType) {
				if(this.currentScene && this.currentScene.faderType) {
					faderType = this.currentScene.faderType;
				} else {
					faderType = 'fader/default';
				}
			}
			currentFader = Lib.loadPrefab(faderType);
			assert(currentFader, 'Wrong fader type for this scene');
			this.stage.addChild(currentFader);
		}
	}
	
	/// #if EDITOR
	__setCurrentContainerContent(object) {
		if(modals.length > 0) {
			this.hideModal();
			this.showModal(object);
		} else {
			this.showScene(object);
		}
	}
	
	__clearStage() {
		while(this.modalsCount > 0) {
			this.hideModal();
		}
		while(showStack.length > 0) {
			let s = showStack.pop();
			this.stage.addChild(s);
			s.remove();
		}
		if(currentFader) {
			this.faderEnd();
		}
		if(this.currentScene) {
			this.currentScene.remove();
			this.currentScene = null;
		}
	}
	
	_getScenesStack() {
		return showStack;
	}
	
	/// #endif
	
	showModal(displayObject) {
		
		if(typeof displayObject === "string") {
			displayObject = Lib.loadPrefab(displayObject);
		}
		
		assert(!(displayObject instanceof Scene), 'Scene cant be used as modal');
		modals.push(displayObject);
		this.stage.addChild(displayObject);
	}
	
	hideModal(displayObject, instantly) {
		if(typeof instantly === 'undefined') {
			instantly = displayObject === 'instantly';
			if(instantly) {
				displayObject = undefined;
			}
		}
		let modalToHide;
		if(!displayObject) {
			assert(modals.length > 0, 'Attempt to hide modal when modal list is empty.');
			modalToHide = modals.pop();
		} else {
			let i = modals.indexOf(displayObject);
			assert(i >= 0, 'Attempt to hide modal object which is not in modal list.');
			modalToHide = modals[i];
			modals.splice(i, 1)
		}
		
		if(instantly || game.__EDITORmode) {
			modalToHide.remove();
		} else {
			hiddingModals.push(modalToHide);
		}
	}
	
	static mouseEventToGlobalXY(ev) {
		let b = app.view.getBoundingClientRect();
		let n = ev.clientX - b.left;
		tmpPoint.x = n * (W / b.width);
		n = ev.clientY - b.top;
		tmpPoint.y = n * (H / b.height);
		return tmpPoint;
	}
	
	updateGlobal(dt) {
		if(this.currentScene) {

/// #if EDITOR
			editor.ui.viewport.checkIfNeedRecovery();
			editor.frameUpdateException = true;
			if((!this.__paused || this.__doOneStep) && !this.__EDITORmode) {
/// #endif
				frameCounterTime += dt;
				let limit = 4;
				frameCounterTime = Math.min(frameCounterTime, FRAME_PERIOD * 4);
				while(frameCounterTime > FRAME_PERIOD) {
					
					this.updateFrame();
					frameCounterTime -= FRAME_PERIOD;
/// #if EDITOR
					if(this.__doOneStep) {
						editor.refreshTreeViewAndPropertyEditor();
						this.__doOneStep = false;
						frameCounterTime = 0;
						break;
					}
				}
/// #endif
			}

/// #if EDITOR
			editor.frameUpdateException = false;
/// #endif
			app.renderer.backgroundColor = this.currentScene.backgroundColor;
			
			this.currentScene.interactiveChildren = ((this.modalsCount === 0) && !currentFader);
			let i = this.modalsCount - 1;
			let isCurrent = !currentFader;
			while(i >= 0) {
				modals[i].interactiveChildren = isCurrent;
				isCurrent = false;
				i--;
			}
		}
	}
	
	updateFrame() {
		updateRecursivelly(this.currentContainer);
		if(currentFader) {
			updateRecursivelly(currentFader);
		}
		let i = hiddingModals.length - 1; //hide modals process
		while(i >= 0) {
			let m = hiddingModals[i];
			m.alpha -= 0.1;
			if(m.alpha <= 0.01) {
				m.remove();
				hiddingModals.splice(i, 1);
			}
			i--;
		}
	}
}

let tmpPoint = {};

function updateRecursivelly(o) {
	o.update();
	let a = o.children;
	let arrayLength = a.length;
	for(let i = arrayLength - 1; i >= 0 && o.parent; i--) {
		updateRecursivelly(a[i]);
	}
}


const mouseHandlerGlobal = (ev) => {
	let p = Game.mouseEventToGlobalXY(ev);
	game.mouse.x = Math.round(p.x);
	game.mouse.y = Math.round(p.y);
	game.mouse.click = ev.buttons !== 0;
	game.mouse.buttons = ev.buttons;
	game.mouse.shiftKey = ev.shiftKey;
	game.mouse.altKey = ev.altKey;
	game.mouse.ctrlKey = ev.ctrlKey;
}

export default Game