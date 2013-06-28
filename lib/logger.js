/*
 * This file is part of the conga-socketio module.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * The SocketIoLogger proxies socket.io's logs
 * to the given log4js logger
 * 
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var SocketIoLogger = function(logger){
	this.logger = logger;
};

var levels = [
    'error',
    'warn',
    'info',
    'debug'
];

/**
 * Generate proxy methods
 *
 * @return {void}
 */
levels.forEach(function (name) {
	SocketIoLogger.prototype[name] = function (log) {
		this.logger[name].call(this.logger, log);
	};
});

module.exports = SocketIoLogger;