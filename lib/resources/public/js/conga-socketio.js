(function(conga){

	var SocketIoPlugin = function(config){
		this.config = config;
	};

	SocketIoPlugin.prototype = {

		connect: function(namespace){

			var url = 'http://' + this.config.host + ':' + this.config.port + namespace;
			var socket = io.connect(url);

			socket.request = function(route, params, cb){

				var json = io.JSON.stringify({
					route : route,
					params: params
				});

				this.emit('message', json, function(data){

					if (data.error){
						console.log('ERROR');
						console.log(data);
					}

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