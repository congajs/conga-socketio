/*
 * This file is part of the conga-socketio module.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// built-in modules
var http = require('http');

// third-party modules
var socketio = require('socket.io');

// local modules
var SocketIoLogger = require('./logger');
var WebsocketRequest = require('./request');
var WebsocketResponse = require('./response');

/**
 * The SocketIoListener registers and starts socket.io on the kernel
 * 
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var SocketIoListener = function(){};

SocketIoListener.prototype = {

	/**
	 * Configure and start the socket.io server on the kernel's
	 * server boot event
	 * 
	 * @param  {Object}   event
	 * @param  {Function} next
	 * @return {void}
	 */
	onServerBoot: function(event, next){

		var self = this;
		var container = event.container;
		
		container.get('logger').debug('starting socket.io');

		var config = container.get('config').get('socketio');
		var options = config.options;

		// set the websocket routes on the websocket router
		container.get('websocket.router').setRoutes(container.getParameter('conga.websocket.routes'));

		// configure the store
		this.configureStore(container, config);

		// start the server
		var io = socketio.listen(container.get('express.server'), config.options);

		// override the socket.io logger with the log4js logger
		io.set('logger', new SocketIoLogger(container.get('logger')));

		// store socket.io on the container
		container.set('io', io);

		// get tagged websocket events
		var tags = container.getTagsByName('websocket.event');

		// array to hold on to all socket namespaces
		var namespaces = [];

		// register websocket events
		tags.forEach(function(tag){

			var namespace = tag.getParameter('namespace');

			if (typeof namespace === 'undefined' || namespace === null){
				namespace = '/';
			}

			if (namespaces.indexOf(namespace) === -1){
				namespaces.push(namespace)
			}

			container.get('event.dispatcher').addListener(
				namespace + ':' + tag.getParameter('event'), 
				container.get(tag.getServiceId()), 
				tag.getParameter('method')
			);
		});

		// loop through the namespaces
		namespaces.forEach(function(namespace){

			(function(namespace){

				var ioNamespace = io

					.of(namespace)
					.on('connection', function(socket){

						container.get('event.dispatcher').dispatch(namespace + ':' + 'client.connect', socket, function(){
							container.get('logger').debug('socket.io client connect events executed');
						});

						// handle websocket requests
						socket.on('message', function(json, cb){

							var data = JSON.parse(json);
							var route = container.get('websocket.router').getRouteByName(data.route);
							var controller = container.get(route.controller);

							var req = self.buildWebsocketRequest(socket, data.params);
							var res = self.buildWebsocketResponse();

							// add the conga stuff to request
							req.conga = {
								route: route
							};

							res.return = function(data){

								// run the post filters
								container.get('conga.filter.runner').run(
									route.controller,
									route.action,
									'post',
									req,
									res,
									function(){
										cb(data);
									}
								);
							};

							// kernel.controller.pre_action
							container.get('event.dispatcher').dispatch(
								'kernel.pre_controller', 
								{
									container : container, 
									request : req, 
									response: res, 
									controller: route.controller, 
									action: route.action
								}, 
								function(){
								
									// run the pre filters
									container.get('conga.filter.runner').run(
										route.controller,
										route.action,
										'pre',
										req,
										res,
										function(){
											// call the controller method
											controller[route.action].call(controller, req, res);
										}
									);
								}
							);
						});

						socket.on('disconnect', function(){
							container.get('event.dispatcher').dispatch(namespace + ':' + 'client.disconnect', socket, function(){
								container.get('logger').debug('socket.io client disconnect events executed');
							});
						});
					})

			}(namespace));

		});

		next();
	},

	/**
	 * Load, configure, and set the configured store
	 * on the final options object that gets passed
	 * into the socket.io instance
	 * 
	 * @param  {Container} container
	 * @param  {Object}    config
	 * @return {void}
	 */
	configureStore: function(container, config)
	{
		switch (config.options.store.type){

			case 'redis':

				var RedisStore = require('socket.io/lib/stores/redis')
				  , redis  = require('socket.io/node_modules/redis')
				  , pub    = redis.createClient()
				  , sub    = redis.createClient()
				  , client = redis.createClient();

				config.options.store = new RedisStore({
					redisPub : pub,
					redisSub : sub,
					redisClient : client
				});

				break;

			case 'memory':

				delete config.options.store;
				break;

			default: 

				// namespaced object
				// @todo
		}
	},

	/**
	 * Build a request object from the socket and parameters
	 * 
	 * @param  {Object} socket
	 * @param  {Object} params
	 * @return {WebsocketRequest}
	 */
	buildWebsocketRequest: function(socket, params){

		var request = new WebsocketRequest();

		request.socket = socket;
		request.query = params;
		request.body = params;

		if (typeof socket.handshake.user !== 'undefined'){
			request.user = socket.handshake.user;
		}

		return request;
	},

	/**
	 * Build a response object
	 * 
	 * @return {WebsocketResponse}
	 */
	buildWebsocketResponse: function(){
		var response = new WebsocketResponse();
		return response;
	}
};

module.exports = SocketIoListener;