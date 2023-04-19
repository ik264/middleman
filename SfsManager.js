(function (_global) {
    "use strict";
    //*********************************netbet/component/entity/SfsManager.js
    /* This component is used for 
     * 1.handling Smart fox connection and logic
     * */
    var Netbet = _global.Netbet,										//The root of the project
        SfsManager = Netbet.namespace("Netbet.component.entity.manager.SfsManager"),			//define Tools in namespace
        Constructor = function () { },									//constructor function
        _public = Constructor.prototype;			                    //Use prototype as public member
    //------------------------------------------------------------dependenceies
    //>>>dependent for UML
    var Tools,
        Event,
        UserDO,
        LangObj,
        GameConfig,
        WhiteLabel,
        ApiManager,
        GameHallDO,
        Heaartbet_M,
        GameSetting,
        Environment,
        SystemConfig,
        ScenceManager,
        LineSelection,
        ConfirmMessage,
        QueryParameter,
        RequestManager,
        PreLoginLangKey,
        FootprintManager,
        ReConnectMessage_V;
    //<<<dependent for UML
    //------------------------------------------------------------private variable
    var _event,
        _instance,								                    //instance for this object as singleton
        _isInGame,
        _smartFox,
        _connectLine,
        _preLoginKey,
        // _isConnected,
        _isConnecting,
        _allServerList,
        _timeOutIntRetry,
        _isLogoutByServer,                                  //if set true, no need to reconnect
        _reConnectTryCount;

    //------------------------------------------------------------constant
    var CONST = {
        MAX_RECONNECT: 3,
        AUTO_RECONNECT_NEW_LINE_INTERVAL: 5,
        CONNECTING_SERVER_INTEVAL: 60,
    };

    //------------------------------------------------------------singleton function
    var singleton = function () {
        if (typeof (_instance) !== "object") {
            _instance = new Constructor();
            init();
        }
        return _instance;
    };

    //------------------------------------------------------------private function
    var init = function () {
        setVar();
    };
    var setVar = function () {
        // ScenceManager = Netbet.viewLib.ScenesManager.getInstance();
        UserDO = Netbet.component.entity.UserDO.getInstance();
        GameHallDO = Netbet.component.entity.gameHallDO.getInstance();
        ApiManager = Netbet.component.entity.ApiManager.getInstance();
        LineSelection = Netbet.component.tools.LineSelection.getInstance();
        RequestManager = Netbet.component.entity.RequestManager.getInstance();
        ConfirmMessage = Netbet.component.Messenger.getInstance();
        FootprintManager = Netbet.component.entity.FootprintManager.getInstance();
        ReConnectMessage_V = Netbet.component.tools.ReConnectMessage_V.getInstance();
        Heaartbet_M = Netbet.component.allComponent.heartbeat.model.Heartbeat_M.getInstance();


        Event = Netbet.util.Event;
        LangObj = Netbet.system.lang;
        GameConfig = Netbet.gameConfig;
        SystemConfig = Netbet.system.config;
        Tools = Netbet.component.tools.Tools;
        WhiteLabel = Netbet.system.config.wL;
        GameSetting = GameConfig.gameSetting;
        Environment = Netbet.system.environment;
        QueryParameter = Netbet.system.environment.queryParameter;
        PreLoginLangKey = Netbet.component.entity.langKey.PreLoginLangKey;

        // _isConnected = false;
        _isInGame = false;
        _reConnectTryCount = 0;
        _preLoginKey = new PreLoginLangKey();

        _event = new Event();
        _public._event = _event;	//privilge variable

        ApiManager._event.on("apiEvent", onApiEvent);
    };
    //------------------------------------------------------------API Event function
    var onApiEvent = function ($evt) {
        var _eventType = $evt.eventType;
        switch (_eventType) {
            case "login": onAPIlogin($evt); break;                    //only handler login faile, login success will wait for NavMenu updateSideMenuList event
            //--Apr--removeComment            
            // case "logoutByResetPassword":
            //--Apr--removeComment   
            case "loginPlayerBlacklist": logoutByServer($evt); break;
            case "logout": onAPIlogout($evt); break;        //after connect to server, send login to server
            case "disconnect": disconnectServer(); break;
        }
    }

    var onAPIlogin = function ($evt) {
        if ($evt.errorCode === 0 && _isInGame) {
            ApiManager.sendReLoginSucceed();
            returnToHall();
        }
        // if ($evt.errorCode !== 0) {
        //     var _msgObj = {};
        //     _msgObj.content = _preLoginKey["error" + $evt.errorCode][LangObj.curLang];
        //     _msgObj.confirmTxt = _preLoginKey.confirm[LangObj.curLang];
        //     _msgObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
        //     ConfirmMessage.showErrorMessage(_msgObj);
        // }
    }
    var onAPIlogout = function ($evt) {
        // console.log("apiLogout")
        _isLogoutByServer = true;
        // logoutRequest();
        onSFSLogout($evt);
    }
    var logoutByServer = function ($evt) {
        _isLogoutByServer = true;
        removeListener();
    };
    var disconnectServer = function ($evt) {
        _isLogoutByServer = true;
        _smartFox.disconnect();
    }
    //-------------------------------------------------------------end of API Event and handler
    //------------------------------------------------------------end of onReConnectMessageEvent and handler
    var connectServer = function ($serverLine) {
        if ($serverLine) _connectLine = $serverLine;

        var _host = _connectLine.host,
            _port = parseInt(_connectLine.port);

        // log('connectServer');
        if (!_smartFox) {
            var connecntConfig = {};
            connecntConfig.host = _host;
            connecntConfig.port = _port;
            connecntConfig.zone = "GameServer";
            connecntConfig.debug = false;

            _smartFox = new SmartFox(connecntConfig);

            removeListener();
            setListener();

            if (!_isConnecting) {	//if the state is connecting SF, dont send request again
                _smartFox.connect();
                _isConnecting = true;
                if ($serverLine) LineSelection.setConnectedLine($serverLine.serverIndex);
            }
        }
    }
    var changeServer = function ($serverLine) {
        _connectLine = $serverLine;
        removeListener();
        _smartFox = undefined;
        _isConnecting = false;
        connectServer();
        _reConnectTryCount = 0;
    }

    var setListener = function () {
        _smartFox.addEventListener(SFS2X.SFSEvent.CONNECTION, onSFSConnection);
        _smartFox.addEventListener(SFS2X.SFSEvent.CONNECTION_LOST, onSFSConentionLost);
        _smartFox.addEventListener(SFS2X.SFSEvent.LOGIN_ERROR, onSFSLoginError);
        _smartFox.addEventListener(SFS2X.SFSEvent.LOGIN, onSFSLogin);
        _smartFox.addEventListener(SFS2X.SFSEvent.LOGOUT, onSFSLogout);
        _smartFox.addEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onSFSResponse);
        _smartFox.addEventListener(SFS2X.SFSEvent.SOCKET_ERROR, onSFSSocketError);
    }

    var removeListener = function () {
        _smartFox.removeEventListener(SFS2X.SFSEvent.CONNECTION, onSFSConnection);
        _smartFox.removeEventListener(SFS2X.SFSEvent.CONNECTION_LOST, onSFSConentionLost);
        _smartFox.removeEventListener(SFS2X.SFSEvent.LOGIN_ERROR, onSFSLoginError);
        _smartFox.removeEventListener(SFS2X.SFSEvent.LOGIN, onSFSLogin);
        _smartFox.removeEventListener(SFS2X.SFSEvent.LOGOUT, onSFSLogout);
        _smartFox.removeEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onSFSResponse);
        _smartFox.removeEventListener(SFS2X.SFSEvent.SOCKET_ERROR, onSFSSocketError);
    }
    //--------------------------------------------------------------------------------------start of SFS event handler
    var onSFSConnection = function (evt) {
        // console.log("onSFSConnection",evt);  
        // log("--onSFSConnection",evt);

        if (evt.success) {
            // console.log("success login")            
            // _isConnected = true;
            resetlineId();
            ApiManager.sendOnConnection();
            // _reConnectTryCount = 0;

            if (_isInGame) {
                retrieveIp();
            } else {
                var msg = "Connection failed: " + (evt.content ? evt.content + " (code " + evt.errorCode + ")" : "Is the server running at all?");
            }
        }

        function resetlineId() {
            var _lineIndex = _connectLine.lineTextIndex;
            // console.log("_lineIndex",_lineIndex)            
            LineSelection.changeCurLineIndex(_lineIndex);
        }
        function retrieveIp() {
            var _ipUrl = SystemConfig.sourceDomain + "/geo/?" + new Date().getTime();

            // var _ipUrl = "https://gi-dev.ttt.link:7443/geo/?"+new Date().getTime();

            $.ajax({
                type: "GET",
                dataType: "json",
                cache: false,
                contentType: "application/json",
                url: randomNum(_ipUrl),
                crossDomain: true,
                timeout: 5000,
                success: function (returnData) {
                    Environment.location = returnLocationObj(returnData);
                    relogin();
                },
                error: function () {
                    getIpError()
                }
            });
        }
        function randomNum($url) {
            var _currentTimpStamp = Date.now().toString(),
                _fourDigitalRandomNum = 1000 + Math.floor(Math.random() * 1000),
                _saltAndPepper = _currentTimpStamp + _fourDigitalRandomNum.toString(),
                _hasQueryString = $url.indexOf("?") > -1,
                _firstChara = (_hasQueryString) ? "&t=" : "?t=";

            return $url + _firstChara + _saltAndPepper;
        }
        function returnLocationObj($data) {
            // console.log("ip==================="+$data.ip)            
            return { "countryCode": $data.country_code, "countryName": $data.country_name, "query": $data.ip };
        }
        function relogin() {
            // ReConnectMessage_V.showCancelBtn();
            reLoginInGame();          //************************************************************************************* if comment, in debug*/
        }
        function getIpError() {
            // console.log("getIpError");  
            _smartFox.disconnect();
            ReConnectMessage_V.clearTimer();
            // tryReconnect();
        }
    }
    var onSFSConentionLost = function (evt) {
        // console.log("onSFSConentionLost", evt.reason);
        // log("---onSFSConentionLost", evt);
        // _isConnected = false;
        switch (evt.reason) {
            case SFS2X.Utils.ClientDisconnectionReason.BAN:
                _isInGame = false;
                Heaartbet_M.func("stopHeartbeat")
                // ApiManager.stopHeartBeat();
                ApiManager.userRelogin();
                show6008Message();
                break;

            case SFS2X.Utils.ClientDisconnectionReason.IDLE:
            case SFS2X.Utils.ClientDisconnectionReason.MANUAL:
            case SFS2X.Utils.ClientDisconnectionReason.UNKNOWN:
                onSFSSocketError(evt);
                break;

            case SFS2X.Utils.ClientDisconnectionReason.KICK:
            default:
                var error = "You have been disconnected; reason is: " + evt.reason;
                _isInGame = false;
                Heaartbet_M.func("stopHeartbeat")
                // ApiManager.stopHeartBeat();

                var _msgObj = {};
                _msgObj.content = _preLoginKey["error" + 100012][LangObj.curLang];
                _msgObj.confirmTxt = _preLoginKey.confirm[LangObj.curLang];
                _msgObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
                _msgObj.confirmCallback = checkReturnUrl;
                ConfirmMessage.showErrorMessage(_msgObj);
                break;
        }
        function show6008Message() {
            var _sendObj = {};
            _sendObj.content = _preLoginKey.error6008[LangObj.curLang];
            _sendObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
            _sendObj.confirmTxt = _preLoginKey.confirm[LangObj.curLang];
            _sendObj.confirmCallback = checkReturnUrl();
            ConfirmMessage.showErrorMessage(_sendObj)
        }
        function checkReturnUrl() {
            var _okFunc,
                _returnurl = Environment.queryParameter.returnurl;
            if (_returnurl) {
                var _urlLink = decodeURIComponent(_returnurl);
                _okFunc = function () {
                    window.location.href = _urlLink;
                }
            } else {
                if (UserDO.getAccountType() === 100) {
                    _okFunc = function () {
                        reloadPage();
                    }
                } else {
                    _okFunc = function () {
                        closeWindow();
                    }
                }

            }
            return _okFunc;
        }
    }

    var onSFSLoginError = function (evt) {
        //--May--removeComment    
        // console.log("onSFSLoginError",evt)
        //--May--removeComment    
        ApiManager.loginError();
    }
    var onSFSLogin = function (evt) {
        _reConnectTryCount = 0;
        //--May--removeComment    
        // ApiManager.startHeartBeat();
        //--May--removeComment    

        $('#popupLayer').hide();
    }
    var onSFSLogout = function (evt) {
        //--May--removeComment    
        // warn("onSFSLogout");
        // console.log("---onSFSLogout",evt);
        //--May--removeComment    
        removeListener();							//prevent others popup to show
        if (UserDO.getAccountType() === 100) { 					// case in user come from normal login
            logoutNormalUser(evt)
        } else {													// case in user come from platform login
            logoutPlatformUser(evt);
        }

        function logoutNormalUser(evt) {
            reloadPage();
        }
    }
    var onSFSResponse = function (evt) {
        //--May--removeComment    
        // log("---onSFSResponse", evt);
        //--May--removeComment    
        var cmd = evt.cmd;
        ApiManager.update(cmd, evt.params);
    }
    var onSFSSocketError = function (evt) {
        // console.warn("onSFSSocketError")        
        //         log("---onSFSSocketError",evt);
        //--May--removeComment    
        // ApiManager.stopHeartbeat();
        //--May--removeComment    
        Heaartbet_M.func("stopHeartbeat")
        ApiManager.clearRequestQueue();
        tryReconnect();
    }
    //--------------------------------------------------------------------------------------end of SFS event handler
    var isConnected = function () {
        // log("isConnected", _isConnected)
        return _smartFox && _smartFox.isConnected();
        // return _isConnected;
    }
    var logoutRequest = function () {
        return _smartFox.send(new SFS2X.Requests.System.LogoutRequest());
    }
    var loginRequest = function ($userName, $password, $opt) {
        return _smartFox.send(new SFS2X.Requests.System.LoginRequest($userName, $password, $opt, "GameServer"));
    }
    var sendRequest = function ($cmd, $obj) {
        _smartFox.send(new SFS2X.Requests.System.ExtensionRequest($cmd, $obj));
    }


    var tryReconnect = function () {
        if (!isNeedReconnect()) return;

        if (_reConnectTryCount < CONST.MAX_RECONNECT) {				// try reConnect in 3 times
            // ReConnectMessage_V.setInTablePosition(ConfirmMessage.getInTablePosition());
            ReConnectMessage_V.setInTablePosition(ConfirmMessage.getInGame());
            ReConnectMessage_V.showReconnectMessage(_preLoginKey.connectionLost[LangObj.curLang], _reConnectTryCount + 1);
            ApiManager.sendOnConnectionLost();
            _timeOutIntRetry = setTimeout(reconnect, 300);

        } else {														// retry time > 3 times

            // repingAllServer();
            var _newServerLine = LineSelection.nextServerLine();
            changeServer(_newServerLine);
        }

        function isNeedReconnect() {
            var _gameState = Heaartbet_M.getGameState();

            if (_gameState === 'maintenance') return false;                     //if system is under maintenance, no need to retry connect
            if (_isLogoutByServer) return false;                                                //if user was logout by server, no need to reconnect

            return true;
        }
        function reconnect() {
            //--May--removeComment    
            //warn("reconnect:",_reConnectTryCount);
            //--May--removeComment    
            clearTimeout(_timeOutIntRetry);
            _reConnectTryCount++;
            reConnectServer();
        }
    }

    var reConnectServer = function () {
        _smartFox.disconnect();
        removeListener();
        _smartFox = undefined;
        _isConnecting = false;
        connectServer();
    }
    var reLoginInGame = function () {

        var _loginObj = UserDO.getLoginObj();

        _loginObj.f = returnIpAddress();
        _loginObj.k = LineSelection.getLineText();
        _loginObj.l = LineSelection.getServerIndex();

        platformUserRelogn();

        function platformUserRelogn() {
            //--May--removeComment    
            // _loginObj.j = UserDO.getRefreshCode();
            //--May--removeComment    
            loginRequest("", "", _loginObj);
        }
        function returnIpAddress() {
            if ((Environment.location && Environment.location.query)) {
                return stringToBytes(Environment.location.query);
            } else {
                return "";
            }
        }
        function stringToBytes(str) {
            var b = [];
            for (var i = 0; i < str.length; ++i) {
                var charCode = str.charCodeAt(i);
                if (charCode > 0xFF)  // char > 1 byte since charCodeAt returns the UTF-16 value
                {
                    throw new Error('Character ' + String.fromCharCode(charCode) + ' can\'t be represented by a US-ASCII byte.');
                }
                b.push(charCode);
            }
            return b;
        }
    }
    var hideReconnectPopup = function () {
        ReConnectMessage_V.clearTimer();
    }
    var resetTryInt = function () {
        _reConnectTryCount = 0;
        // _isConnected = false;
    }

    var reloadPage = function () {
        // log('reloadPage');
        logoutRequest();

        if (Environment.isPWA) {
            Netbet.viewLib.PWAStorage.saveValue('logout', 'true');
            var $accountType = parseInt(Netbet.viewLib.PWAStorage.getValue('accountType'));
            if ($accountType === 100) {
                Tools.removeQueryParam("sessionId");
                Tools.addQueryParam("app", "pwa");
            }
        }

        var url = null;
        //--May--removeComment    
        // if (Environment.platform === "Desktop") {
        //     url = window.location.origin + window.location.pathname + "?appType=6";
        // } else {
        //     url = window.location.origin + window.location.pathname + "?appType=3";
        //     if (Environment.isPWA) {
        //         url += "&app=pwa";
        //     }
        // }
        //--May--removeComment    
        url = window.location.origin + window.location.pathname;
        if (Environment.isPWA) {
            url += "?app=pwa";
        }
        window.location.replace(url);
    }
    var closeWindow = function () {
        var myWindow = window.open("", "_self");
        myWindow.document.write("");
        setTimeout(function () { myWindow.close(); }, 500);
    }

    var logoutPlatformUser = function (evt) {
        // warn('logoutPlatformUser');
        var _returnUrl = QueryParameter.returnurl,
            _messageCode = (evt && evt.errorCode) ? "error" + evt.errorCode : "logoutUser",
            _errorMessage = _preLoginKey[_messageCode][LangObj.curLang];

        // _isConnected = false;
        if (checkProtocol(_returnUrl) !== undefined) {		// have return url from system
            retutnToURL();
            return;
        }

        if (checkWlSetting()) {
            return;
        } else {
            showMessageToBlankPage();
        }

        function checkWlSetting() {
            if (!WhiteLabel.sessIdInValidConfirmBtn && _isInGame) {
                var _msgObj = {};

                _msgObj.content = _errorMessage;
                _msgObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
                ConfirmMessage.showErrorMessage(_msgObj);
                return true;
            }
            return false;
        }
        function retutnToURL() {
            // log('retutnToURL');
            var _newUrl = checkProtocol(_returnUrl),
                _msgObj = {};

            _msgObj.content = _errorMessage;
            _msgObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
            _msgObj.confirmTxt = _preLoginKey.confirm[LangObj.curLang];
            _msgObj.confirmCallback = function () {
                window.location.href = _newUrl;
            };
            ConfirmMessage.showErrorMessage(_msgObj);
            return;
        }

        function checkProtocol(_returnUrl) {
            if (typeof _returnUrl == 'undefined') {
                return;
            }

            if (_returnUrl.indexOf("http") !== -1 || _returnUrl.indexOf("https") !== -1) {
                return (decodeURIComponent(_returnUrl));
            } else {
                return ("http://" + decodeURIComponent(_returnUrl));
            }
        }
        function showMessageToBlankPage() {
            var _msgObj = {};
            _msgObj.content = _errorMessage;
            _msgObj.titleTxt = _preLoginKey.errorTitle[LangObj.curLang];
            _msgObj.confirmTxt = _preLoginKey.confirm[LangObj.curLang];
            _msgObj.confirmCallback = goToBlankPage;
            ConfirmMessage.showErrorMessage(_msgObj);
        }
        function goToBlankPage() {
            var myWindow = window.open("", "_self");
            myWindow.document.write("");
        }
    }

    var returnToHall = function () {
        var ScenceManager = Netbet.viewLib.ScenesManager.getInstance(),
            _curPage = FootprintManager.getCurPage(),
            _reLoginReturnPage = GameSetting.reLoginReturnPage,
            _reLogin2ndReturnPage = GameSetting.reLogin2ndReturnPage,
            _prevPage,
            _nextPage;

        ScenceManager.resetHistoryStack();

        _nextPage = (_curPage === _reLoginReturnPage) ? _reLogin2ndReturnPage : _reLoginReturnPage;
        _prevPage = (_nextPage === _reLogin2ndReturnPage) ? [_reLoginReturnPage] : [];
        ScenceManager.openScene(_nextPage, _prevPage);

        //--May--removeComment    

        // var _currentPage = ScenceManager.current,
        //     _mobileReturnHall = "gameHall",
        //     _desktopReturnHall = "/Refresh/dragonHall";

        // if (Environment.platform == 'Desktop') {
        //     ScenceManager.openScene(_desktopReturnHall);
        // } else {
        //     var _curPage = FootprintManager.getCurPage();

        //     ScenceManager.resetHistoryStack();
        //     if (_curPage === "GAME_HALL") {
        //         ScenceManager.openScene("dragonHall");
        //     } else {
        //         ScenceManager.openScene(_mobileReturnHall);
        //     }
        // }
        //--May--removeComment    
    }

    var heartbeatTimeout = function () {
        var _isConnected = isConnected();

        if (_isConnected) {
            Heaartbet_M.func("startHeartbeat");
        } else {
            tryReconnect();
        }
    }
    var getSessionToken = function () {
        return _smartFox.sessionToken;
    }
    var disconnect = function () {

    }
    //------------------------------------------------------------privilege function
    //--May--removeComment    
    // var log = function () {
    //     var args = Array.prototype.slice.call(arguments);
    //     var msg = "";
    //     if (args.length >= 1) {
    //         msg = args.shift();
    //     }
    //     if (args.length >= 1) {
    //         // console.log('[ServiceManager]:', msg, args.shift()); 

    //         for (var i in args) {
    //             // console.log('parmas',args[i]);
    //         }
    //         return;
    //     }
    //     // console.log('[ServiceManager]:', msg); 

    // }
    // var warn = function () {
    //     var args = Array.prototype.slice.call(arguments);
    //     var msg = "";
    //     if (args.length >= 1) {
    //         msg = args.shift();
    //     }
    //     if (args.length >= 1) {
    //         console.warn('[ServiceManager]:', msg, args.shift());

    //         for (var i in args) {
    //             console.log('parmas', args[i]);
    //         }
    //         return;
    //     }
    //     // console.warn('[ServiceManager]:',msg);
    // }
    // var error = function (msg) { console.error('[ServiceManager]:', msg); }
    // var deprecated = function (oldFunc, newFunc) {
    //     warn('\nFunction [' + oldFunc + '] is deprecated!\nUse the [' + newFunc + '] property instead.');
    // }
    //--May--removeComment    

    //-----------------------------------------------------------public methods
    _public.connectServer = connectServer;
    _public.isConnected = isConnected;
    _public.loginRequest = loginRequest;
    _public.logoutRequest = logoutRequest;
    _public.sendRequest = sendRequest;
    _public.changeServer = changeServer;
    _public.returnToHall = returnToHall;
    _public.reConnectServer = reConnectServer;
    _public.hideReconnectPopup = hideReconnectPopup;
    _public.resetTryInt = resetTryInt;
    _public.onSFSResponse = onSFSResponse;
    _public.heartbeatTimeout = heartbeatTimeout;
    _public.getSessionToken = getSessionToken;
    _public.logoutByServer = logoutByServer;

    //-----------------------------------------------------------get/set methods
    _public.getIsInGame = function () {
        return _isInGame;
    }
    _public.setIsInGame = function (val) {
        _isInGame = val;
    }

    SfsManager.getInstance = singleton;
})(this);
