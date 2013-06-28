conga-socketio
==============

Overview
--------

This is a bundle for the [Conga.js](https://github.com/congajs/conga) framework which 
integrates [Socket.IO](http://socket.io) into a project.

Configuration
-------------

Example:

    // config.yml
    socketio:
        enabled: true
        port: 3001
        options:
            origins: '*:*'
            store:
                type: memory
                options:

            heartbeats: true
            resource: /socket.io
            transports: [websocket, htmlfile, xhr-polling, jsonp-polling]
            authorization: false

            log level: 3


Usage
-----


### Configuring Listeners


