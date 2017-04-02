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

		container.get('logger').debug('[conga-socketio] - setting up socket.io');

		var config = container.get('config').get('socketio');
		var options = config.options;

		// set the websocket routes on the websocket router
		container.get('websocket.router').setRoutes(container.getParameter('conga.websocket.routes'));

		// configure the store
		this.configureStore(container, config);

		var io = require('socket.io')(container.get('express.server'));

		// store socket.io on the container
		container.set('io', io);

		// get tagged websocket events
		var tags = container.getTagsByName('websocket.event');

		// array to hold on to all socket namespaces
		var namespaces = ['/'];

		if (tags){

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
		}

		// loop through the namespaces
		namespaces.forEach(function(namespace){

			(function(namespace){

				var ioNamespace = io

					.of(namespace)
					.on('connection', function(socket){

						container.get('logger').debug('[conga-socketio] - websocket client connected to: ' + namespace);

						// fire connection event
						container.get('event.dispatcher').dispatch(namespace + ':' + 'client.connect', { socket : socket }, function(){
							container.get('logger').debug('[conga-socketio] - websocket client connect events executed');
						});

						// handle websocket requests
						socket.on('conga.request', function(data, cb){

							container.get('event.dispatcher').dispatch(namespace + ':' + 'client.message', { socket : socket, message : data }, function(){

								// check if this is request for a conga route
								if (data.route){

									var route = container.get('websocket.router').getRouteByName(data.route);

									if (!route){
										cb(self.buildErrorResponse(404, 'Route not found: ' + data.route));
										return;
									}

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

												// run callback on client
												if (typeof cb === 'function'){
													cb(data);
												}
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

													try {
														// call the controller method
														controller[route.action].call(controller, req, res);

													} catch (err){

														cb(self.buildErrorResponse(500, err));
													}
												}
											);
										}
									);
								}
							});
						});

						// fire disconnect event
						socket.on('disconnect', function(){
							container.get('event.dispatcher').dispatch(namespace + ':' + 'client.disconnect', { socket : socket }, function(){
								container.get('logger').debug('[conga-socketio] - socket.io client disconnect events executed');
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
		var storeOptions = config.options.store.options;

		if (!storeOptions){
			storeOptions = {};
		}

		switch (config.options.store.type){

			case 'redis':

				var host = storeOptions.host || '127.0.0.1';
				var port = storeOptions.port || 6379;

				delete storeOptions.host;
				delete storeOptions.port;

				var RedisStore = require('socket.io/lib/stores/redis')
				  , redis  = require('socket.io/node_modules/redis')
				  , pub    = redis.createClient(port, host, storeOptions)
				  , sub    = redis.createClient(port, host, storeOptions)
				  , client = redis.createClient(port, host, storeOptions);

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
				// memcached, mongodb, etc...
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
	},

	/**
	 * Build a websocket response for an error
	 *
	 * @param  {Number} code
	 * @param  {String} message
	 * @return {Object}
	 */
	buildErrorResponse: function(code, message){
		return {
			error: {
				code: code,
				message: message
			}
		}
	}
};

module.exports = SocketIoListener;
