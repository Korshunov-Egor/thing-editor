import Tilemap from "/thing-engine/js/components/tilemap.js";
import game from "/thing-engine/js/game.js";

let IS_SELECTION_LOADING_TIME = false;
let needSaveSelectionInToHistory = false;

class Selection extends Array {
	
	select(object, add) {
		if (!add) {
			this.clearSelection();
		}
		if (__getNodeExtendData(object).isSelected) {
			this.remove(object);
		} else {
			this.add(object);
		}
		this.sortSelectedNodes();
		editor.refreshTreeViewAndPropertyEditor();
	}
	
	sortSelectedNodes() {
		recalculateNodesDeepness();
		this.sort(sortByDeepness);
	}
	
	loadSelection(data) {
		IS_SELECTION_LOADING_TIME = true;
		if (!data || data.length === 0) {
			editor.selection.clearSelection();
		} else {
			data.some(selectNodeByPath);
		}
		editor.refreshTreeViewAndPropertyEditor();
		IS_SELECTION_LOADING_TIME = false;
	}
	
	saveSelection() {
		return this.map(getPathOfNode);
	}
	
	clearSelection(refresh) {
		while (this.length > 0) {
			this.remove(this[this.length - 1]);
		}
		if (refresh) {
			editor.refreshTreeViewAndPropertyEditor();
		}
	}
	
	add(o) {
		assert(!__getNodeExtendData(o).isSelected);
		assert(this.indexOf(o) < 0);
		__getNodeExtendData(o).isSelected = true;
		if(!(o instanceof Tilemap)) {
			o.filters = selectedFilters;
		}
		this.push(o);
		if(o.__onSelect) {
			o.__onSelect();
		}
		editor.ui.viewport.scrollInToScreen(o);
		if(!IS_SELECTION_LOADING_TIME) {
			needSaveSelectionInToHistory = true;
		}
	}
	
	remove(o) {
		assert(__getNodeExtendData(o).isSelected);
		let i = this.indexOf(o);
		assert(i >= 0);
		__getNodeExtendData(o).isSelected = false;
		o.filters = null;
		this.splice(i, 1);
		o.__EDITOR_inner_exitPreviewMode();
		if(!IS_SELECTION_LOADING_TIME) {
			needSaveSelectionInToHistory = true;
		}
	}
}

export default Selection;

const selectionFilter = new PIXI.filters.OutlineFilter(2, 0xffff00);
const selectedFilters = [selectionFilter];

setInterval(() => {
	if (window.editor && editor.selection.length > 0) {
		selectionFilter.color ^= 0x063311;
	}
	if(needSaveSelectionInToHistory) {
		editor.history.addHistoryState(true);
		needSaveSelectionInToHistory = false;
	}

}, 1000 / 60 * 3);

//save/load selection

let getPathOfNode = (node) => {
	let ret = [];
	while (node !== game.stage) {
		ret.push(node.parent.getChildIndex(node));
		node = node.parent;
	}
	return ret;
};

let selectNodeByPath = (path, nodeNum) => {
	let ret = game.stage;
	for (let i = path.length - 1; i >= 0; i--) {
		ret = ret.getChildAt(path[i]);
	}
	if (nodeNum === 0) {
		editor.ui.sceneTree.selectInTree(ret);
	} else {
		editor.selection.add(ret);
	}
};


//-------- sorting selection --------------------------------
let curDeepness;

let recalculateNodesDeepness = () => {
	curDeepness = 0;
	recalculateNodesDeepnessRecursive(game.stage);
};

let recalculateNodesDeepnessRecursive = (n) => {
	__getNodeExtendData(n).deepness = curDeepness++;
	if (n.hasOwnProperty('children')) {
		n.children.some(recalculateNodesDeepnessRecursive);
	}
};

let sortByDeepness = (a, b) => {
	return __getNodeExtendData(a).deepness - __getNodeExtendData(b).deepness;
};
