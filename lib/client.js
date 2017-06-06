/*!
**|   Generic CyTube Client Class
**@
*/

'use strict';

const request = require('request');
const EventEmitter = require('events');

class CyTubeClient extends EventEmitter {
    constructor(server, logger, callback){
        const defaults = {
            agent : 'CyTube Client 0.1a',

            host  : 'cytu.be',
            port  : '443',

            chan  : 'test',
            pass  : null,

            user  : `Test-${Math.random().toString(16).slice(-8)}`,
            auth  : null,
        }

        super();
        Object.assign(this, defaults, server);

        this.logger = {
            log: function(){
                console.log(`[CyTubeClient] ${Array.prototype.join.call(arguments, ' ')}`);
            },
            error: function(){
                console.error(`[CyTubeClient] ${Array.prototype.join.call(arguments, ' ')}`);
            },
        }

        if(typeof callback === 'function'){
            this.once('ready', callback.bind(this))
        }

        this.getSocketURL();
    }

    get configURL() {
        return `https://${this.host}:${this.port}/socketconfig/${this.chan}.json`;
    }

    // https://cytu.be/socketconfig/mlp.json
    // {"servers":[{"url":"https://cytu.be:10443","secure":true},{"url":"http://sea.cytu.be:8880","secure":false}]}
    getSocketURL(){
        this.logger.log('Getting socket config')
        request({
            url: this.configURL,
            headers: {
                'User-Agent': this.agent
            },
            timeout: 20 * 1000
        }, (error, response, body) => {
            if(error){
                this.logger.error(error);
                this.emit('error', new Error('Socket lookup failure'));
            }

            var data = JSON.parse(body);
            let servers = [...data.servers];
            while(servers.length){
                let server = servers.pop();
                if(server.secure === true && server.ipv6 === undefined){
                    this.socketURL = server.url;
                }
            }
            this.logger.log('Socket server url retrieved:', this.socketURL)
            this.emit('ready');
        });
    }

    connect(){
        this.logger.log('Connecting to socket server');
        this.emit('connecting');

        this.socket = require('socket.io-client')(this.socketURL)
            .on('error', (err)=>{
                this.emit('error', new Error(err));
            })
            .once('connect', ()=>{
                this.emit('connected');
                this.assignHandlers();
            })
            ;
        return this;
    }

    start(){
        this.logger.log('Connecting to channel.');
        this.socket.emit('joinChannel', {
            name: this.chan
        })
        this.emit('starting');

        this.socket.once('needPassword', ()=>{
            if(typeof this.pass !== 'string'){
                this.emit('error', new Error('Channel requires password'))
            }
            this.logger.log('Sending channel password.')
            this.socket.emit('channelPassword', this.pass);
        })

        this.socket.once('rank', ()=>{
            this.socket.emit('login', Object.assign({}, {
                name: this.user
            }, this.auth ? { pw: this.auth } : undefined));
        })

        this.killswitch = setTimeout(()=>{ 
            this.logger.error('Failure to establish connection within 60 seconds.');
            this.emit('error', new Error('Channel connection failure'))
        }, 60 * 1000);

        this.socket.once('login', (data)=>{
            if(data && data.success){
                this.logger.log('Channel connection established.');
                this.emit('started');
                clearTimeout(this.killswitch);
            }
        });

        return this;
    }

    // TODO: consider Cal's suggestion to monkey patch SocketIO
    assignHandlers(){
        this.logger.log('Assigning Handlers');
        [
/*
    These are from CyTube /src/user.js
*/
            'announcement',
            'clearFlag',
            'clearVoteskipVote',
            'disconnect',
            'kick',
            'login',
            'setAFK',
            'setFlag',

/*
    Current list as of 2017-06-04
    The following command was used to get this list from CyTube /src/channel/

    $> ( spot emit && spot broadcastAll ) \
        | awk {'print $2'} | sed 's/"/\n"/g' \
        | grep '"' | grep -Pi '[a-z]' | sort -u
*/

            'addFilterSuccess',
            'addUser',
            'banlist',
            'banlistRemove',
            'cancelNeedPassword',
            'changeMedia',
            'channelCSSJS',
            'channelNotRegistered',
            'channelOpts',
            'channelRankFail',
            'channelRanks',
            'chatFilters',
            'chatMsg',
            'clearchat',
            'clearFlag',
            'closePoll',
            'cooldown',
            'costanza',
            'delete',
            'deleteChatFilter',
            'drinkCount',
            'effectiveRankChange',
            'emoteList',
            'empty',
            'errorMsg',
            'listPlaylists',
            'loadFail',
            'mediaUpdate',
            'moveVideo',
            'needPassword',
            'newPoll',
            'noflood',
            'playlist',
            'pm',
            'queue',
            'queueFail',
            'queueWarn',
            'rank',
            'readChanLog',
            'removeEmote',
            'renameEmote',
            'searchResults',
            'setCurrent',
            'setFlag',
            'setLeader',
            'setMotd',
            'setPermissions',
            'setPlaylistLocked',
            'setPlaylistMeta',
            'setTemp',
            'setUserMeta',
            'setUserProfile',
            'setUserRank',
            'spamFiltered',
            'updateChatFilter',
            'updateEmote',
            'updatePoll',
            'usercount',
            'userLeave',
            'userlist',
            'validationError',
            'validationPassed',
            'voteskip',
            'warnLargeChandump',
        ].forEach((frame)=>{
            this.socket.on(frame, function(){
                this.emit(frame, ...arguments);
            }.bind(this));
        });
    }

}

module.exports = CyTubeClient;