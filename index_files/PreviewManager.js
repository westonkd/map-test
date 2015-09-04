/**
 * @classDescription	dojo 1.3 widget that is in charge of all the interactivities on preview window or frame
 * 						in-context editing functionalities are isolated into its own library
 * @copyright			Ingeniux Corporation 2012
 * @author				Arnold Wang
 */
dojo.provide("igx.cms.preview.PreviewManager");
dojo.require("dijit._Widget");


igx.cms.preview.utils = {
	// Function: getCookie
	// Parameters:	cookieName  - Required.  The name of the cookie.    
	// Returns: String containing the value of the requested cookie. 
	// Description: Generic function to get cookie value for a give cookie name. 	
	getCookie: function(cookieName){
		// separate each cookie
		var cookieList = window.top.document.cookie.split("; ");
		var cookieValue = "";
		
		for (var i = 0; i < cookieList.length; i++) {
			// separate name-value pairs
			var cookie = unescape(cookieList[i]);
			var name = cookie.substring(0, cookie.indexOf("="));
			var value = cookie.substring(cookie.indexOf("=") + 1);
			
			// Compare the cookie name
			if (name == cookieName) {
				cookieValue = value;
				break;
			}
		}
		
		if (cookieValue == "undefined" || cookieValue == null) 
			cookieValue = "";
		
		return cookieValue;
	},
	
	
	// Function: setCookie
	// Parameters:	cookieName  - Required.  The name of the cookie.
	//              cookieValue - Required.  The value of the cookie.
	//              isPermanent - Optional.  true (default value) if the cookie is forever.    
	//                                       false if the cookie is only valid for the browser session.
	// Returns: nothing
	// Description: This function is used to set a browser cookie. 				    
	setCookie: function(cookieName, cookieValue){
		var isPermanent = true;
		
		// if there are three arguments
		if (arguments.length == 3) {
			isPermanent = arguments[2];
		}
		
		// Create a cookie string to write to the cookie file
		var cookieToken = cookieName + "=" + escape(cookieValue) + ";";
		
		// if this is a permanent cookie
		if (isPermanent == true) {
			// Set the expiration date of the cookie to be one year from now
			var expDate = new Date();
			expDate.setDate(365 + expDate.getDate());
			
			cookieToken = cookieToken + " " +
			"expires=" +
			expDate.toGMTString() +
			";";
		}
		
		window.top.document.cookie = cookieToken;
	}
};

(function(){
	var props = {
		isPopupWindow: false,
		defaultPreviewUrlBase: "",
		customQueryStrings: "",
		doICE: false,
		baseZIndex: 100,
		
		genericSkinParameters: {
			topHeight: [68, 41],
			bottomHeight: [92, 41],
			leftWidth: [20, 41],
			rightWidth: [19, 43]
		},
		
		siteInput: null,
		userAgentInput: null,
		deviceInput: null,
		rotatorButton: null,
		queryStringInput: null,
		formInput: null,
		cookiesInput: null,
		serverVariablesInput: null,
		putTargetInput: null,
		transformOptionsInput: null,
		
		allPagesCheck: null,
		
		updateButton: null,
		
		pubTgtDropdownLabel: null,
		
		previewFrame: null,
		previewContainer: null,
		
		expandedPageXml: null,
		externalPreviewPostForm: null,
		
		_handlers: null,
		
		mainWindow: null,
		
		imgTL: null,
		imgT: null,
		imgTR: null,
		imgL: null,
		imgR: null,
		imgBL: null,
		imgB: null,
		imgBR: null,
		
		viewCell: null,
		sizableContainer: null,
		frameContainer: null,
		frameContainerMidCell: null,
		frameCell: null,
		
		rotated: false,
		
		inputStates: null,
		
		postCreate: function(){
			this._handlers = [];
		},
		
		destroy: function(){
			dojo.forEach(this._handlers, function(h){
				dojo.disconnect(h);
			}, this);
			this.inherited(arguments);
		},
		
		startup: function(){
		
			this.mainWindow = !this.isPopupWindow ? window.top : window.top.opener.top;
			
			//if is pop up, directly listen to resize event
			//other, listen to resize event from the preview frame
			this._handlers.push(dojo.connect(window, "onresize", this, "onResize"));
			
			//hook up the attachments, even attachment change will update preview frame, allPagesInput change will save cookie and update preview frame
			var inputAttachPointAttributeName = "inputattachpoint";
			var inputs = dojo.query("[" + inputAttachPointAttributeName + "]");
			dojo.forEach(inputs, function(input){
				var attachPointName = input.getAttribute(inputAttachPointAttributeName);
				if (attachPointName && !this[attachPointAttributeName]) {
					this[attachPointName] = input;
					
					//listen to onchange event, except deviceInput, it has its own handler show changing skins
					if (attachPointName != "deviceInput") 
						this._handlers.push(dojo.connect(this[attachPointName], "onchange", this, "onUpdate"));
				}
			}, this);
			
			//hook up the rest of attachpoints
			var attachPointAttributeName = "attachpoint";
			var attaches = dojo.query("[" + attachPointAttributeName + "]");
			dojo.forEach(attaches, function(node){
				var name = node.getAttribute(attachPointAttributeName);
				if (name && !this[name]) {
					this[name] = node;
				}
				
				//disable image dragging for skin images.
				if (node.nodeName.toLowerCase() == "img" && name.length > 3 && name.substr(0,3) == "img") {
					this._handlers.push(dojo.connect(node, "onmousedown", dojo.hitch(this, function(evt){
						dojo.stopEvent(evt);
						return false;
					})));
				}
				
			}, this);
			
			//get the cookie of showAllPages and set the check box
			var strInclude = this.mainWindow.igx.utils.cookies.getCookie(this.mainWindow.igx.cms.cookieNames.INCLUDE_ALL_PAGES);
			var bIncludeAllPages = (strInclude == "true"); // If the cookie doesn't exist, default to false
			this.allPagesCheck.checked = bIncludeAllPages;
			
			//if pub target list item is 1 or 0, hide the select
			if (this.mainWindow.igx.cms.currentPubTargetId) {
				this.putTargetInput.value = this.mainWindow.igx.cms.currentPubTargetId;
			}
			
			if (this.putTargetInput.options.length <= 1) {
				this.putTargetInput.style.display = "none";
				this.pubTgtDropdownLabel.style.display = "none";
			}
			
			//listen to show all pages checkbox and update button
			this._handlers.push(dojo.connect(this.allPagesCheck, "onclick", this, "onInclude"));
			this._handlers.push(dojo.connect(this.allPagesCheck, "onkeyup", this, "handleIncludeKey"));
			
			if (this.deviceInput) {
				this._handlers.push(dojo.connect(this.deviceInput, "onchange", this, "onDeviceChange"));
			}
			
			if (this.rotatorButton) {
				this._handlers.push(dojo.connect(this.rotatorButton, "onclick", this, "onRotate"));
				this._handlers.push(dojo.connect(this.rotatorButton, "onkeyup", this, "keyupRotate"));
			}
			
			if (this.updateButton) {
				this._handlers.push(dojo.connect(this.updateButton, "onclick", this, "onUpdate"));
				this._handlers.push(dojo.connect(this.updateButton, "onkeyup", this, "handleUpdateButtonKey"));
			}
			
			this._getInputStates();
			
			this.onResize();
			
			if (this.deviceInput) 
				this.onDeviceChange();
			else 
				this.onUpdate();
			
			this.inherited(arguments);
		},
		
		onResize: function(evt){
			if (this.deviceInput && this.deviceInput.value) {
				var windowsize = dojo.contentBox(document.body);
				var toolbarSize = dojo.contentBox(this.toolbar);
				dojo.marginBox(this.sizableContainer, {
					w: windowsize.w,
					h: windowsize.h - toolbarSize.h - 20
				});
			}
			else {
				this.sizableContainer.style.width = "100%";
				this.sizableContainer.style.height = "100%";
			}
		},
		
		onRotate: function(evt){
			this.rotated = !this.rotated;
			this._updateRotateImage();
			this.onDeviceChange();
		},
		
		_updateRotateImage: function(){
			this.rotatorButton.src = "../../images/icons/mobile/rotate_" + (this.rotated ? "vertical" : "horizontal") + ".png";
		},
		
		keyupRotate: function(evt){
			if (evt.keyCode == dojo.keys.ENTER || evt.keyCode == dojo.keys.SPACE) 
				this.onRotate();
		},
		
		_inputStateCookieName: "IGXPreviewInputState",
		
		_setInputStates: function(){
			this.inputStates = {
				site: this.siteInput.value,
				pubTarget: this.putTargetInput.value
			};
			
			if (this.deviceInput) {
				this.inputStates.device = this.deviceInput.value;
				this.inputStates.rotated = this.rotated;
			}
			
			if (this.userAgentInput) {
				this.inputStates.userAgent = this.userAgentInput.value;
			}
			
			if (this.isPopupWindow) {
				this.inputStates.transformOption = this.transformOptionsInput.value;
				this.inputStates.querystring = this.queryStringInput.value;
				this.inputStates.form = this.formInput.value;
				this.inputStates.cookie = this.cookiesInput.value;
				this.inputStates.serverVars = this.serverVariablesInput.value;
			}
			
			igx.cms.preview.utils.setCookie(this._inputStateCookieName, dojo.toJson(this.inputStates));
		},
		
		_getInputStates: function(){
			var inputStateCookieValue = igx.cms.preview.utils.getCookie(this._inputStateCookieName);
			this.inputStates = !!inputStateCookieValue ? dojo.fromJson(inputStateCookieValue) : null;
			
			if (this.inputStates) {
				//change the inputs based persisted value
				this.siteInput.value = this.inputStates.site;
				
				if (this.userAgentInput) 
					this.userAgentInput.value = this.inputStates.userAgent;
				
				if (this.deviceInput) 
					this.deviceInput.value = this.inputStates.device;
				
				if (this.rotatorButton) {
					this.rotated = this.inputStates.rotated;
					this._updateRotateImage();
				}
				
				this.putTargetInput.value = this.inputStates.pubTarget;
				
				if (this.isPopupWindow) {
					this.transformOptionsInput.value = this.inputStates.transformOption || "";
					this.queryStringInput.value = this.inputStates.querystring || "";
					this.formInput.value = this.inputStates.form || "";
					this.cookiesInput.value = this.inputStates.cookie || "";
					this.serverVariablesInput.value = this.inputStates.serverVars || "";
				}
			}
		},
		
		/**
		 * Change skin based on device. If device value is empty, then use default desktop view with no skin
		 * @param {Object} evt
		 */
		onDeviceChange: function(evt){
			this.onResize();
			
			var deviceUserAgent = this.deviceInput.value;
			
			var selectedOption;
			for (var i = 0; i < this.deviceInput.options.length; i++) {
				var option = this.deviceInput.options[i];
				if (option && option.selected) {
					selectedOption = option;
					break;
				}
			}			
			
			var deviceIsTablet = selectedOption.getAttribute("tablet") == "true";
			
			var skinName = "";
			
			if (deviceUserAgent) {
				var lUserAgent = deviceUserAgent.toLowerCase();
                var iphonePos = lUserAgent.indexOf("iphone");
                var ipadPos = lUserAgent.indexOf("ipad");
                
				if (iphonePos > -1 && ipadPos < 0) {
					skinName = "iphone";
				}
				else if (ipadPos > -1 && iphonePos < 0) {
					skinName = "ipad";
				}
                else if (iphonePos > -1 && ipadPos > -1) {
                    skinName = (iphonePos < ipadPos) ? "iphone" : "ipad";
                }
				else {
					skinName = !deviceIsTablet ? "gphone" : "gtablet";
				}
			}
			
			//change rotator button display, depends on if user agent is empty or not
			this.showHide(this.rotatorButton, !!deviceUserAgent);
			
			if (!skinName) {
				//hide all images and give the table 100% width and height
				this._toggleSkinImages(false);
				this.frameContainer.style.width = "100%";
				this.frameContainer.style.height = "100%";
				this.frameContainerMidCell.width = "100%";
				this.frameCell.height = "100%";
				this.sizableContainer.style.paddingTop = "0px";
			}
			else {
				this.sizableContainer.style.paddingTop = "15px";
				
				//set path of skin images
				var orientationName = this.rotated ? "horizontal" : "vertical";
				var skinPath = "../../images/icons/mobile/skins/" + skinName + "/" + orientationName + "/";
				
				this.imgTL.src = skinPath + "tl.png";
				this.imgT.src = skinPath + "t.png";
				this.imgTR.src = skinPath + "tr.png";
				this.imgL.src = skinPath + "l.png";
				this.imgR.src = skinPath + "r.png";
				this.imgBL.src = skinPath + "bl.png";
				this.imgB.src = skinPath + "b.png";
				this.imgBR.src = skinPath + "br.png";
				
				this.frameContainer.style.width = "auto";
				this.frameContainer.style.height = "auto";
				

				
				//get the resolution from selected option
				var width = parseInt(selectedOption.getAttribute("swidth"), 10);
				if (isNaN(width)) 
					width = 240;
				
				var height = parseInt(selectedOption.getAttribute("sheight"), 10);
				if (isNaN(height)) 
					height = 320;
				
				if (this.rotated) {
					//when rotated, width and height swap
					var _t = width;
					width = height;
					height = _t;
				}
				
				//iphone skin top bar reduction
				if (skinName == "iphone" || skinName == "ipad") 
					height -= 20;
				
				this.frameContainerMidCell.width = width + "px";
				if (dojo.isWebKit || dojo.isIE) {
					this.frameCell.width = width + "px";
					this.frameCell.height = height + "px";
				}
				
				this.imgT.style.width = width + "px";
				this.imgB.style.width = width + "px";
				this.imgL.style.height = height + "px";
				this.imgR.style.height = height + "px";
				
				//for generic skin change all image sizes to fit
				if (skinName == "gphone") {
					if (!this.rotated) {
						this.imgT.style.height = this.genericSkinParameters.topHeight[0] + "px";
						this.imgB.style.height = this.genericSkinParameters.bottomHeight[0] + "px";
						
						this.imgL.style.width = this.genericSkinParameters.leftWidth[0] + "px";
						this.imgR.style.width = this.genericSkinParameters.rightWidth[0] + "px";
					}
					else {
						this.imgL.style.width = this.genericSkinParameters.topHeight[0] + "px";
						this.imgR.style.width = this.genericSkinParameters.bottomHeight[0] + "px";
						
						this.imgT.style.height = this.genericSkinParameters.rightWidth[0] + "px";
						this.imgB.style.height = this.genericSkinParameters.leftWidth[0] + "px";						
					}
				}
				else if (skinName == "gtablet") {
					if (!this.rotated) {
						this.imgT.style.height = this.genericSkinParameters.topHeight[1] + "px";
						this.imgB.style.height = this.genericSkinParameters.bottomHeight[1] + "px";
						
						this.imgL.style.width = this.genericSkinParameters.leftWidth[1] + "px";
						this.imgR.style.width = this.genericSkinParameters.rightWidth[1] + "px";
					}
					else {
						this.imgL.style.width = this.genericSkinParameters.topHeight[1] + "px";
						this.imgR.style.width = this.genericSkinParameters.bottomHeight[1] + "px";
						
						this.imgT.style.height = this.genericSkinParameters.rightWidth[1] + "px";
						this.imgB.style.height = this.genericSkinParameters.leftWidth[1] + "px";						
					}
				}
				else {
					this.imgT.style.height = "auto";
					this.imgB.style.height = "auto";
					
					this.imgL.style.width = "auto";
					this.imgR.style.width = "auto";
				}
				
				//show images when sources are all set
				this._toggleSkinImages(true);
			}
			
			this.onUpdate();
		},
		
		_toggleSkinImages: function(show){
			this.showHide(this.imgTL, show);
			this.showHide(this.imgT, show);
			this.showHide(this.imgTR, show);
			this.showHide(this.imgL, show);
			this.showHide(this.imgR, show);
			this.showHide(this.imgBL, show);
			this.showHide(this.imgB, show);
			this.showHide(this.imgBR, show);
		},
		
		showHide: function(node, show, showType){
			node.style.display = show ? (showType || "") : "none";
		},
		
		handleIncludeKey: function(evt){
			if (evt.keyCode === dojo.keys.ENTER || evt.keyCode === dojo.keys.SPACE) 
				this.onInclude(evt);
		},
		
		onInclude: function(evt){
			var bIncludeAllPages = this.allPagesCheck.checked;
			this.mainWindow.igx.utils.cookies.setCookie(this.mainWindow.igx.cms.cookieNames.INCLUDE_ALL_PAGES, bIncludeAllPages.toString());
			this.onUpdate(evt, true);
		},
		
		handleUpdateButtonKey: function(evt){
			if (evt.keyCode === dojo.keys.ENTER || evt.keyCode === dojo.keys.SPACE) 
				this.onUpdate(evt);
		},
		
		_getPreviewFrameSource: function(previewUrlBase){
		
			var uaQueryString = this.deviceInput && dojo.marginBox(this.deviceInput).w ? "" : "&UserAgent=" + this.userAgentInput.value;
			
			return this.isPopupWindow ? 
				previewUrlBase + "?" + this.customQueryStrings +
				"&Site=" +
				this.siteInput.value +
				uaQueryString +
				"&QS=" +
				encodeURIComponent(this.queryStringInput.value).replace(/\+/g, "%2B") +
				"&Form=" +
				encodeURIComponent(this.formInput.value).replace(/\+/g, "%2B") +
				"&Cookies=" +
				encodeURIComponent(this.cookiesInput.value).replace(/\+/g, "%2B") +
				"&SvrVars=" +
				this.serverVariablesInput.value +
				"&PubTgt=" +
				this.putTargetInput.value +
				"&XForm=" +
				this.transformOptionsInput.value +
				"&Include=" +
				this.allPagesCheck.checked +
                "&useCheckedOut=" + (this.mainWindow.igx.cms.userManager.canCheckInOthers())
			: 
				previewUrlBase + "?" + this.customQueryStrings +
				"&ice=" +
				this.doICE +
				"&Site=" +
				this.siteInput.value +
				uaQueryString +
				"&PubTgt=" +
				this.putTargetInput.value +
				"&QS=&Form=&Cookies=&XForm=1" +
				"&Include=" +
				this.allPagesCheck.checked +
                "&useCheckedOut=" + 
                (this.mainWindow.igx.cms.userManager.canCheckInOthers());
		},
		
		_getExternalPreviewContentProviderUrl: function(defaultPreviewUrlBase){
			var uaQueryString = this.deviceInput && dojo.marginBox(this.deviceInput).w ? "&Device=" + this.deviceInput.value : "&UserAgent=" + this.userAgentInput.value;
			
			return this.isPopupWindow ? 
				defaultPreviewUrlBase + "?" + this.customQueryStrings +
				"&Site=" +
				this.siteInput.value +
				uaQueryString +
				"&QS=" +
				encodeURIComponent(this.queryStringInput.value).replace(/\+/g, "%2B") +
				"&Form=" +
				encodeURIComponent(this.formInput.value).replace(/\+/g, "%2B") +
				"&Cookies=" +
				encodeURIComponent(this.cookiesInput.value).replace(/\+/g, "%2B") +
				"&SvrVars=" +
				this.serverVariablesInput.value +
				"&PubTgt=" +
				this.putTargetInput.value +
				"&XForm=4" +
				"&Include=" +
				this.allPagesCheck.checked +
                "&useCheckedOut=" + (this.mainWindow.igx.cms.userManager.canCheckInOthers())
			: 
				defaultPreviewUrlBase + "?" + this.customQueryStrings +
				"&ice=" +
				this.doICE +
				"&Site=" +
				this.siteInput.value +
				uaQueryString +
				"&PubTgt=" +
				this.putTargetInput.value +
				"&QS=&Form=&Cookies=&XForm=4"
				"&Include=" +
				this.allPagesCheck.checked +
                "&useCheckedOut=" + 
                (this.mainWindow.igx.cms.userManager.canCheckInOthers());
		},
		
		_listenPreviewFrameLoad: function(){
			this.previewLoadHandler = null;
			this.hitchedPreviewLoadHandler = null;
			
			if (dojo.isIE) {
				this.hitchedPreviewLoadHandler = dojo.hitch(this, "onPreviewFrameLoad");
				if (this.previewFrame.addEventListener) {
					this.previewFrame.addEventListener('load', this.hitchedPreviewLoadHandler, false);
				}
				else if (this.previewFrame.attachEvent) {
					this.previewFrame.attachEvent('onload', this.hitchedPreviewLoadHandler);
				}
			}
			else {
				//This does not work in IE dojo trac #9609
				this.previewLoadHandler = dojo.connect(this.previewFrame, "onload", this, "onPreviewFrameLoad");
			}
		},
		
		previewUrl:function(){
		    this._setInputStates();
			
			var topDojo = this.mainWindow.dojo13;


            //check if the selected pub target use external preview url or not
            //if yes and external url is set, use that
            var selectedOption;
            for (var i = 0; i < this.putTargetInput.options.length; i++) {
                var option = this.putTargetInput.options[i];
                if (option && option.selected) {
                    selectedOption = option;
                    break;
                }
            }
            
            var externalUrl = false;
		
		     //if only one target, use it
            if (this.putTargetInput.options.length == 1) 
                selectedOption = this.putTargetInput.options[0];
            
            if (selectedOption && selectedOption.getAttribute("useexternalpreviewurl").toLowerCase() == "true") {
                externalUrl = selectedOption.getAttribute("externalpreviewurl");   
            }
            if(externalUrl){
                return externalUrl;
            }else{
                return this.defaultPreviewUrlBase;
            }
		    
		    
		
		},
		
		onUpdate: function(evt, allowEventBubbleUp){
			this._setInputStates();
			
			var topDojo = this.mainWindow.dojo13;
			
			this.useExternalPreview = false;
			var externalPreviewExpandedUrlProviderUrl = "";
			var iceUpdateUrl = "";
			
			var previewUrlBase = this.defaultPreviewUrlBase;

            //check if the selected pub target use external preview url or not
            //if yes and external url is set, use that
            var selectedOption;
            for (var i = 0; i < this.putTargetInput.options.length; i++) {
                var option = this.putTargetInput.options[i];
                if (option && option.selected) {
                    selectedOption = option;
                    break;
                }
            }
            
            //if only one target, use it
            if (this.putTargetInput.options.length == 1) 
                selectedOption = this.putTargetInput.options[0];
            
            if (selectedOption && selectedOption.getAttribute("useexternalpreviewurl").toLowerCase() == "true") {
                var externalUrl = selectedOption.getAttribute("externalpreviewurl");
                if (externalUrl) {
                    //externalUrl = decodeURIComponent(externalUrl);					
					if (this._isExternalUrl(externalUrl)) {
						//check if the url is dss preview. If yes, turn it into relative path
						previewUrlBase = externalUrl;
						
						var lowerPreviewUrlBase = previewUrlBase.toLowerCase();
						lowerPreviewUrlBase = dojo.trim(lowerPreviewUrlBase);
						
						// remove trailing /
						while (lowerPreviewUrlBase.substring(lowerPreviewUrlBase.length - 1) == "/")
							lowerPreviewUrlBase = lowerPreviewUrlBase.substr(0, lowerPreviewUrlBase.length - 1);
							
						var dssPreviewUrlBase = "dsspreview/igxdynamicpreview";
						
						if (lowerPreviewUrlBase.length >= dssPreviewUrlBase.length + 1
							&& lowerPreviewUrlBase.substring(lowerPreviewUrlBase.length - dssPreviewUrlBase.length - 1) == "/" + dssPreviewUrlBase)
						{
							previewUrlBase = "../../../" + dssPreviewUrlBase;
						}
					}
					else
						previewUrlBase = "../../../xml/custom/" + externalUrl;
                    
                    this.useExternalPreview = true;
                    
                    //update the markup update url in ICE
                    if (window.igx && igx.cms && igx.cms.ice) {
                        iceUpdateUrl = selectedOption.getAttribute("icefieldmarkupupdateurl");
                        if (!this._isExternalUrl(externalUrl)) {
							iceUpdateUrl = "../../../xml/custom/" + iceUpdateUrl;
						}
						else {
							var lowerIceUpdateUrl = iceUpdateUrl.toLowerCase();
							lowerIceUpdateUrl = dojo.trim(lowerIceUpdateUrl);
							
							// remove trailing /
							while (lowerIceUpdateUrl.substring(lowerIceUpdateUrl.length - 1) == "/")
								lowerIceUpdateUrl = lowerIceUpdateUrl.substr(0, lowerIceUpdateUrl.length - 1);
								
							var dssIceUpdateUrlBase = "dsspreview/igxdticeupdate";
							
							if (lowerIceUpdateUrl.length >= dssIceUpdateUrlBase.length + 1
								&& lowerIceUpdateUrl.substring(lowerIceUpdateUrl.length - dssIceUpdateUrlBase.length - 1) == "/" + dssIceUpdateUrlBase)
							{
								//ice update starts from ajax in main window as /client location, so only need to backtrack one level
								iceUpdateUrl = "../" + dssIceUpdateUrlBase;
							}							
						}
                    }
                    this.useDynamicPreview = selectedOption.getAttribute("dynamicpreview").toLowerCase() == "true";
                }
            }

			
			//generate preview frame src and external preview expand url provider's address
			var previewFrameUrl = this._getPreviewFrameSource(previewUrlBase);			
			
			this._listenPreviewFrameLoad();
			
			if (igx.cms.ice && igx.cms.ice.inContextEdit) {
				igx.cms.ice.inContextEdit.useExternalPreview = this.useExternalPreview;
				igx.cms.ice.inContextEdit.baseZIndex = this.baseZIndex;
				igx.cms.ice.inContextEdit.initFields(this.previewFrame, this.putTargetInput.value, iceUpdateUrl);
			}
			
			if (!this.useExternalPreview) 
				this.updatePreviewFrame(previewFrameUrl);
			else {				
				
				if (!this.useDynamicPreview && (!this.transformOptionsInput || this.transformOptionsInput.value != "4")) {
					var externalPreviewExpandedUrlProviderUrl = this._getExternalPreviewContentProviderUrl(this.defaultPreviewUrlBase);
					
					//if using old external preview, will need to first XHR to get the expanded page XML, then
					//set the hidden form and have the form post to the iframe to do preview
					var d = this.mainWindow.igx.cms.ajax.getPageExpandedXml(externalPreviewExpandedUrlProviderUrl, false);
					d.addCallback(dojo.hitch(this, function(data){
						this.updatePreviewFrame(previewFrameUrl, data);
					}));
				}
				else {
					//when using dynamic preview, it is the same as normal preview, to hit the preview site directly
					this.updatePreviewFrame(previewFrameUrl);
				}
			}
			
			// Set a Timeout to attach an onUnload hook to the iframe's window if not using the seperate Preview window
			if (!window.opener) 
				this.interval = setInterval(dojo.hitch(this, "onPreviewFrameUnload"), 1000);
			
			if (!allowEventBubbleUp && !!evt) 
				dojo.stopEvent(evt);
		},
		
		updatePreviewFrame: function(previewFrameUrl, data){
			this.externalPreviewPostForm.action = previewFrameUrl;
			this.expandedXmlInput.value = encodeURIComponent(data) || "";
		    //device emulation goes to form post, to prevent long user agent breaking the preview page url

			this.userAgentEmulatedInput.value = ""; //prevent fallback to generic device if mobile is not enabled

			if (this.deviceInput && dojo.marginBox(this.deviceInput).w) {
				this.userAgentEmulatedInput.value = this.deviceInput.value;
			}
			this.externalPreviewPostForm.submit();
		},
		
		onPreviewFrameLoad: function(evt){
			this.processLinksOnPreviewDoc();
			
			//handle key events in preview frame document
			if (!this.isPopupWindow) {
				try {
					window.top.dojo.event.connect(this.previewFrame.contentWindow.document, "onkey", window.top.igx.cms.keyManager, "processKeyEvent");
				} 
				catch (e) {
				}
			}
			
			if (dojo.isIE && this.hitchedPreviewLoadHandler) {
				//this.previewFrame.removeEventListener(this.hitchedPreviewLoadHandler);
				delete this.hitchedPreviewLoadHandler;
			}
			else if (this.previewLoadHandler) {
				dojo.disconnect(this.previewContainer);
				delete this.previewLoadHandler;
			}
			
			//only connect onPreviewLoad of content pane when not in ICE mode, otherwise, ice script will connect it for you			
			if ((!igx.cms || !igx.cms.ice) && !this.isPopupWindow) {
				this.mainWindow.dojo.widget.byId("previewTab").onPreviewLoaded();
			}
		},
		
		processLinksOnPreviewDoc: function(){
		
			//process links when:
			//inline
			//pop up but use external preview
			var linksNeedProcessing = (!this.isPopupWindow);
			if (this.mainWindow && linksNeedProcessing) {
				//dojo.byId not always work with iframe, especially IE
				var previewDoc = this.mainWindow.igx.nullHelper.make(document.getElementsByTagName("IFRAME")[0]).propogate(function(frm){
					return dojo.isIE ? frm.contentWindow.document : frm.contentDocument;
				}).closeAndReturn(null);
				
				if (previewDoc) {
					var links
					try {
						links = previewDoc.getElementsByTagName("A");
					} 
					catch (e) {
						//might be cross-site scripting, need to not throw error is that is the case
					}
					
					if (links) {
						dojo.forEach(links, function(link){
							var href = link.getAttribute("href");
							var match = this.getXidFromUrl(href);
							if (match) {
								newPageId = match[1];
								var query = this.getHrefQueryStrings(href);
								link.setAttribute("href", "");
								//Necessary so the function closes around the value instead of the variable
								var clickFunc = dojo.hitch(this, function(xId, queryStr){
									return dojo.hitch(this, function(evt){
										//inline preview, use top window site tree to load page and that will update the preview url of this frame
										//popup preview with change url of current window
										if (!this.isPopupWindow) 
											this.loadPageFromXid(xId, queryStr);
										else if (window.top.opener) 
											this.refreshPreviewWithXid(xId);
										
										dojo.stopEvent(evt);
										return false;
									});
								})(newPageId, query);
								link.onclick = clickFunc;
							}
						}, this);
					}
				}
			}
		},
		
		getHrefQueryStrings: function(link){
			var query = {};
			
			var splitQuery = link.split("?");
			if (splitQuery.length == 2) {
				var getQueries = splitQuery[1].split("&");
				for (var i = 0; i < getQueries.length; i++) {
					var nameValue = getQueries[i].split("=");
					if (nameValue.length == 2) {
						query[nameValue[0]] = nameValue[1];
					}
				}
			}
			
			return query;
		},
		
		refreshPreviewWithXid: function(xid){
			window.location.href = this._generatePreviewUrl(xid);
		},
		
		_generatePreviewUrl: function(xid){
			var url = window.location.href;
			
			return url.replace(/pageId\=x\d+/g, "pageId=" + xid);
		},
		
		setPreviewFrameUnload: function(){
			try {
				this.previewFrame.contentWindow.onunload = dojo.hitch(this, "onUnloadPreviewFrame");
				clearInterval(this.interval);
			} 
			catch (e) {
			}
		},
		
		onPreviewFrameUnload: function(evt){
			this.mainWindow.setTimeout(dojo.hitch(this, function(){
				try {
					this.loadPageFromPreview();
				} 
				catch (e) {
				
					setTimeout(dojo.hitch(this, "onPreviewFrameUnload"), 100);
				}
			}), 100);
		},
		
		/**
		 * A method that will retry loading page until successful
		 */
		loadPageFromPreview: function(){
			try {
				var newPageId = null;
				var match = null;
				try {
					//add try catch to deal with non-html content in preview window causes error
					match = this.getXidFromUrl(this.previewFrame.contentWindow.location.href);
				} 
				catch (e) {
				}
				if (match) {
					newPageId = match[1];
					this.loadPageFromXid(newPageId);
				}
			} 
			catch (e) {
				// If an exception is thrown, it is probably an "Access is denied" error.
				// This most likely means that the window has not finished loading yet.
				// Set another timeout to check again
				setTimeout(dojo.hitch(this, "loadPageFromPreview"), 100);
			}
		},
		
		loadPageFromXid: function(xId, query){
			if (this.mainWindow &&
			this.mainWindow.igx &&
			this.mainWindow.igx.cms &&
			this.mainWindow.igx.cms.controller &&
			this.mainWindow.igx.cms.controller.loadPage &&
			!this.mainWindow.igx.cms.navigatingInPreview) {
				this.mainWindow.igx.cms.navigatingInPreview = true;
				var loadPageHandler = this.mainWindow.igx.cms.controller.loadPage(xId, null, false, query);
				loadPageHandler.addCallback(dojo.hitch(this, function(){
					this.mainWindow.igx.cms.navigatingInPreview = false;
				}));
			}
		},
		
		getXidFromUrl: function(url){
			if (url) {
				return url.match(/(x\d+)\.xml/);
			}
			else {
				return null;
			}
		},
		
		_isExternalUrl: function(url){
			return url.length > 7 &&
			(url.substr(0, 5) == "http:" || url.substr(0, 6) == "https:") ||
			url.length > 1 && url.substr(0, 1) == "/";
		}
	};
	
	dojo.declare("igx.cms.preview.widget.PreviewManager", dijit._Widget, props);
})();

var g_previewManager = null;

dojo.addOnLoad(function(){
	//doesn't need domNode reference to create this widget, its attachpoints are queried during startup
	g_previewManager = new igx.cms.preview.widget.PreviewManager({
		isPopupWindow: g_isPopupWindow,
		defaultPreviewUrlBase: g_defaultPreviewUrlBase,
		customQueryStrings: g_customQueryStrings,
		doICE: g_doICE,
		baseZIndex: g_baseZIndex
	});
	
	g_previewManager.startup();
});

dojo.addOnUnload(function(){
	if (g_previewManager) 
		g_previewManager.destroy();
	if (igx && igx.cms && igx.cms.ice && igx.cms.ice.inContextEdit) 
		igx.cms.ice.inContextEdit.destroy();
})

