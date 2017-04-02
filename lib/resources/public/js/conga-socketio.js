(function(conga){

	var SocketIoPlugin = function(config){
		this.config = config;
	};

	SocketIoPlugin.prototype = {

		/**
		 * Connect to the given namespace and return a socket
		 * 
		 * @param  {String} namespace
		 * @return {Socket}
		 */
		connect: function(namespace){

			if (!namespace){
				namespace = '/';
			}

			var url = 'http://' + this.config.host + ':' + this.config.port + namespace;
			var socket = io.connect(url);

			socket.request = function(route, params, cb){

				var json = {
					route : route,
					params: params
				};

				this.emit('conga.request', json, function(data){
					if (typeof cb === 'function'){
						cb(data);
					}
				});
			};

			return socket;
		}
	};

	// register the plugin
	conga.plugin('socket.io', SocketIoPlugin);

})(conga);