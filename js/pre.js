/* global $, getHTML triggerEvent, setHTML, isContentEditable, isTextNode, Snip */

// custom functions inspired from jQuery
// special thanks to
// bling.js - https://gist.github.com/paulirish/12fb951a8b893a454b32 

/**
 * extends NodeList prototype per iframe present in the webpage
 * calls itself every 500ms to capture any newly added iframes as well
 * @param {String} prop 
 * @param {Function} func 
 */
// only one method exposed to user
var extendNodePrototype;
(function protoExtensionWork(){
	// called by detector.js
	// to be able to reuse the existing interval
	window.updateAllValuesPerWin = function(win){		
		for(var i = 0, count = protoExtensionNames.length; i < count; i++)
			setNodeListPropPerWindow(protoExtensionNames[i], protoExtensionFunctions[i], win);
	};

	var protoExtensionNames = [], protoExtensionFunctions = [];
	extendNodePrototype = function(prop, func){
		protoExtensionNames.push(prop);
		protoExtensionFunctions.push(func);
	};

	function setNodeListPropPerWindow(prop, func, win){
		// in case of custom created array of Nodes, Array.prototype is necessary
		win.Array.prototype[prop] = win.NodeList.prototype[prop] = function() {
			var args = [].slice.call(arguments, 0);
			this.forEach(function(node) {
				func.apply(node, args);
			});
			return this;
		};

		win.Node.prototype[prop] = func;	
	}
})();

(function(){
	window.OBJECT_NAME_LIMIT = 30;
	window.MONTHS = ["January", "February", "March",
					"April", "May", "June", "July", "August", "September",
					"October", "November", "December"];
	window.DAYS = ["Sunday", "Monday", "Tuesday",
							"Wednesday", "Thursday", 
							"Friday", "Saturday"];

	NodeList.prototype.__proto__ = Array.prototype;

	// used for triggering context menu event
	// on window object
	window.triggerEvent = function(node, eventName, obj){
		var ev = new CustomEvent(eventName, {
			detail: obj || null
		});
		// those functions which need to access
		// the custom values will need to separately
		// access the "detail" property, in such a way:
		// (ev.detail && ev.detail[requiredProperty]) || ev[requiredProperty]
		// because if detail is not passed it's always null

		node.dispatchEvent(ev);
	};

	extendNodePrototype("trigger", function(eventName, obj){
		triggerEvent(this, eventName, obj);
	});

	window.$ = function(selector){
		var elms = document.querySelectorAll(selector), elm;

		// cannot always return a NodeList/Array
		// as properties like firstChild, lastChild will only be able
		// to be accessed by elms[0].lastChild which is too cumbersome
		if(elms.length === 1){
			elm = elms[0];
			// so that I can access the length of the returned
			// value else length if undefined
			elm.length = 1;
			return elm;
		}
		else return elms;
	};

	$.new = function(tagName){
		return document.createElement(tagName);
	};

	extendNodePrototype("on", window.on = function (name, fn, useCapture) {
		var names = name.split(/,\s*/g);

		for(var i = 0, len = names.length; i < len; i++)
			this.addEventListener(names[i], fn, useCapture);

		return this;
	});

	// inserts the newNode after `this`
	extendNodePrototype("insertAfter", function(newNode){
		this.parentNode.insertBefore(newNode, this.nextSibling);
		return this;
	});

	// returns true if element has class; usage: Element.hasClass("class")
	extendNodePrototype("hasClass", function(className) {
		return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
	});

	extendNodePrototype("toggleClass", function(cls){
		this.classList.toggle(cls);
		return this;
	});

	extendNodePrototype("addClass", function(cls){
		// multiple classes to add
		if(!Array.isArray(cls))
			cls = [cls];

		cls.forEach(function(e){
			this.classList.add(e);
		}.bind(this));

		return this;
	});

	extendNodePrototype("removeClass", function(cls){
		// multiple classes to remove
		if(!Array.isArray(cls))
			cls = [cls];

		cls.forEach(function(e){
			this.classList.remove(e);
		}.bind(this));

		return this;
	});

	extendNodePrototype("isTextBox", function(){
		return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
	});

	extendNodePrototype("attr", function(name, val){
		if(typeof val != "undefined"){
			this.setAttribute(name, val);
			return this;
		}
		else return this.getAttribute(name);
	});

	// returns innerText
	window.getText = function(node){
		return getHTML(node, "innerText");
	};

	// sets innerText
	window.setText = function(node, newVal){
		return setHTML(node, newVal, "innerText");
	};

	window.getHTML = function(node, prop){
		if(!node) return;

		if(isTextNode(node))
			return node.textContent.replace(/\u00a0/g, " ");

		switch(node.tagName){
			case "TEXTAREA":
			case "INPUT":
				return node.value;
			default:
				return node[prop || "innerHTML"];
		}
	};

	window.setHTML = function(node, newVal, prop, isListSnippets){
		// in case number is passed; .replace won't work
		newVal = newVal.toString();

		if(isTextNode(node)){
			node.textContent = newVal.replace(/ /g, "\u00a0");
			return node;
		}


		switch(node.tagName){
			case "TEXTAREA":
			case "INPUT":
				node.value = newVal.replace("<br>", "\n")
									.replace("&nbsp;", " "); break;
			default:
//				console.log(newVal);
				if(prop === "innerText")
					// but innertext will collapse consecutive spaces
					// do not use textContent as it will collapse even single newlines
					node.innerText = newVal.replace("<br>", "\n")
											.replace("&nbsp;", " ");
				// first .replace is required as at the end of any text
				// as gmail will not display single space for unknown reason
				else {					
					try{
						node.innerHTML = newVal.replace(/ $/g, "&nbsp;")
											.replace(/ {2}/g, " &nbsp;");

						if(!isListSnippets)
							node.innerHTML = node.innerHTML.replace(/\n/g, "<br>");						
						else setHTMLPurificationForListSnippets(node);
					}catch(e){
						console.log("From setHTML: `node` argment is undefined");
					}
				}
		}

		return node;
	};

	function setHTMLPurificationForListSnippets(node){
		// after we start splitting these text nodes and insert <br>s
		// the original text nodes and their count gets lost
		function getCurrentTextNodes(){
			var textNodesInNode = [], child;

			for(var i = 0, len = node.childNodes.length; i < len; i++){
				child = node.childNodes[i];
				if(isTextNode(child))
					textNodesInNode.push(child);
			}

			return textNodesInNode;
		}
		var list = getCurrentTextNodes(), childCount = list.length,
			count = 0, child,
			textNodes, i, len, tNode, $br, text;
		
		for(; count < childCount; count++){
			child = list[count];
			
			// if a textnode has a single newline
			// => it is present between two element nodes
			// otherwise it would have had some text as well
			// so replace ONE newline first
			// BUT BUT this leads to loss of newline after
			// a simpler element node like <a> or <b>
			// hence, DO NOT do this
			
			textNodes = child.textContent.split(/\n/g);
			i = 0; len = textNodes.length;
			
			for(; i < len; i++){
				text = textNodes[i];
				tNode = document.createTextNode(text);
				$br = $.new("br");
				node.insertBefore($br, child);
				node.insertBefore(tNode, $br);
			}
			// textNodes may be:
			// ["a"] or ["a", "b"]
			// the former implies there was NO newline in case like
			// <pre></pre>a<bq></bq>
			// hence have to remove the LAST newline that we've inserted
			node.removeChild($br);
			node.removeChild(child);
		}

		// block level elements already occupy a full line, hence, remove 
		// ONE <br> after them
		node.querySelectorAll("pre, blockquote, ol, ul").forEach(function(elm){			
			var br = elm.nextElementSibling;
			if(br && br.tagName === "BR") br.parentNode.removeChild(br);
		});

		node.querySelectorAll("ol, ul").forEach(Snip.formatOLULInListParentForCEnode);
	}

	// prototype alternative for setHTML/getHTML
	// use only when sure that Node is "not undefined"
	extendNodePrototype("html", function(textToSet, prop, isListSnippets){
		// can be zero/empty string; make sure it's undefined
		return typeof textToSet !== "undefined" ?
				setHTML(this, textToSet, prop, isListSnippets) :
				getHTML(this, prop);
	});

	// prototype alternative for setText/getText
	// use only when sure that Node is "not undefined"
	extendNodePrototype("text", function(textToSet){
		// can be zero/empty string; make sure it's undefined
		return this.html(textToSet, "innerText");
	});

	extendNodePrototype("unwrap", function(){
		var children = this.childNodes,
			nextSibling = this.nextSibling, child,
			len = children.length,
			parent = this.parentNode;

		while(len > 0){
			child = children[len - 1];

			if(nextSibling) 
				parent.insertBefore(child, nextSibling);
			else parent.appendChild(child);

			nextSibling = child;
			len--;
		}

		parent.removeChild(this);
	});

	updateAllValuesPerWin(window);

	// replaces string's `\n` with `<br>` or reverse
	// `convertForHTML` - true => convert text for display in html div (`.innerHTML`)
	// false => convrt text for dislplay in text area (`.value`)
	window.convertBetweenHTMLTags = function(string, convertForHTML){
		var map = [["<br>", "\\n"], [" &nbsp;", "  "]],
			regexIndex = +convertForHTML, replacerIdx = +!convertForHTML, elm,
			i = 0, len = map.length;

		for(; i < len; i++){
			elm = map[i];
			string = string.replace(new RegExp(elm[regexIndex], "g"), elm[replacerIdx]);
		}

		var container = $.new("div").html(string),
			selector = "pre + br, blockquote + br, li + br, ol > br, ol + br, ul + br, ul > br",
			unnecessaryBRs = container.querySelectorAll(selector),
			count = unnecessaryBRs.length;

		for(i = 0; i < count; i++){
			elm = unnecessaryBRs[i];
			elm.parentNode.removeChild(elm);
		}

		return container.innerHTML.replace(/&nbsp; ?&nbsp;<li>/g, "<li>");
	};

	window.isEmpty = function(obj) {
		for(var prop in obj)
			if(obj.hasOwnProperty(prop))
				return false;

		return true;
	};

	window.escapeRegExp = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};

	// prepends 0 to single digit num and returns it
	// as a string
	window.padNumber = function(num){
		num = parseInt(num, 10);

		return (num <= 9 ? "0" : "") + num;
	};

	window.getFormattedDate = function(timestamp){
		var d = (timestamp ? new Date(timestamp) : new Date()).toString();

		// sample date would be:
		// "Sat Feb 20 2016 09:17:23 GMT+0530 (India Standard Time)"
		return d.substring(4, 15);
	};

	window.isObject = function(o){
		return Object.prototype.toString.call(o) === "[object Object]";
	};

	// should use this since users may use foreign language
	// characters which use up more than two bytes
	window.lengthInUtf8Bytes = function(str) {
		// Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
		var m = encodeURIComponent(str).match(/%[89ABab]/g);
		return str.length + (m ? m.length : 0);
	};

	window.isTextNode = function(node){
		return node.nodeType === 3;
	};

	// if it is a callForParent, means that a child node wants 
	// to get its parents checked
	// callForParent: flag to prevent infinite recursion
	window.isContentEditable = function(node, callForParent){
		var tgN = node && node.tagName, attr, parent;

		// insanity checks first
		if(!node || tgN === "TEXTAREA" || tgN === "INPUT" || !node.getAttribute)
			return false;
		
		// can also be a textnode
		attr = node.attr ? node.attr("contenteditable") : null;

		// empty string to support <element contenteditable> markup
		if(attr === "" || attr === "true" || attr === "plaintext-only")
			return true;

		// important part below
		// note that if we introduce a snippet
		// then it generates <span> elements in contenteditable `div`s
		// but they don't have content-editable true attribute
		// so they fail the test, hence, here is a new check for them
		// search if their parents are contenteditable
		// but only do this if the current node is not a textarea
		// which we have checked above

		if(callForParent) return false;
		
		parent = node;		
		do{
			parent = parent.parentNode;

			if(!parent) return false;
			
			if(isContentEditable(parent, true)) return true;
		}while(parent !== window.document);
		
		return false;
	};

	window.checkRuntimeError = function(){
		if(chrome.runtime.lastError){
			alert("An error occurred! Please press Ctrl+Shift+J/Cmd+Shift+J, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me resolve your issue and improve my extension. Thanks!");
			console.log(chrome.runtime.lastError);
			return true;
		}
	};

	// Returns a function, that, as long as it continues to be invoked, will not
	// be triggered. The function will be called after it stops being called for
	// N milliseconds. If `immediate` is passed, trigger the function on the
	// leading edge, instead of the trailing.
	window.debounce = function(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments,
				later = function() {
					timeout = null;
					if (!immediate) func.apply(context, args);
				},
				callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	};
})();