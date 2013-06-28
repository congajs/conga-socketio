/*
 * This file is part of the conga-socketio module.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * The WebsocketRequest holds all the request information
 * that a controller needs and mocks an expressjs request
 * 
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var WebsocketRequest = function(){};

WebsocketRequest.prototype = {

	query: {},
	body: {}

};

module.exports = WebsocketRequest;