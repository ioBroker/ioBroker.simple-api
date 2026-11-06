# Older changes
## 3.0.5 (2025-03-13)
* (bluefox) Corrected the indication of running mode in admin
* (bluefox) Corrected the writing of numeric values
* (bluefox) Clear cache after 10 minutes

## 3.0.0 (2025-03-09)
* BREAKING: When the adapter is configured to work as a web extension, no own local port is opened anymore
* (bluefox) Updated packages
* (bluefox) Migrated to TypeScript
* (bluefox) If State/Object not found, the response will be 404 (and not 500)
* (bluefox) If a user has no permission, the response will be 403 (and not 401)

## 2.8.0 (2024-05-23)
* (foxriver76) ported to `@iobroker/webserver`

## 2.7.2 (2022-10-08)
* (Apollon77) Prepare for future js-controller versions

## 2.7.1 (2022-08-29)
* (bluefox) Check if the port is occupied only on defined interface
* (bluefox) Added JSON config

## 2.7.0 (2022-05-31)
* (crycode-de) Allow use of ack flag for setBulk post requests
* (Apollon77) Return an ack flag too on getBulk

## 2.6.5 (2022-04-14)
* Added support for aggregate and count for queries

## 2.6.4 (2022-03-17)
* (Apollon77) Optimize performance, especially when using names instead of object ids

## 2.6.3 (2022-02-19)
* (Apollon77) Optimize error message for multi-language objects
* (Apollon77) Do not overwrite state properties by object properties

## 2.6.2 (2021-11-12)
* (bluefox) Support of new flags for `getPlainValue`: `json` and `noStringify`

## 2.6.1 (2021-05-13)
* (Apollon77) Catch error in request parsing when malformed (Sentry IOBROKER-SIMPLE-API-16)

## 2.6.0 (2021-05-09)
* (Apollon77) Also URL-Decode the path parts like state ids
* (Apollon77) Optimize for js-controller 3.3

## 2.5.3 (2021-01-25)
* (Apollon77) Make sure that delayed answers are not crashing (Sentry IOBROKER-SIMPLE-API-Z)

## 2.5.2 (2021-01-09)
* (bluefox) Support of new Let's Encrypt (only with js-controller 3.2.x)

## 2.4.8 (2020-09-17)
* (Apollon77) Make sure missing favico file locally is not throwing exceptions (Sentry IOBROKER-SIMPLE-API-G)

## 2.4.7 (2020-08-17)
* (Apollon77) check that targets are an array for "query" requests (Sentry IOBROKER-SIMPLE-API-F)

## 2.4.6 (2020-06-11)
* (Apollon77) Make sure that the adapter is showing the correct error when webserver cannot be initialized (Sentry IOBROKER-SIMPLE-API-7)

## 2.4.5 (2020-05-04)
* (Apollon77) webserver initialization optimized again to prevent errors with invalid certificates

## 2.4.4 (2020-05-02)
* (Apollon77) Make sure Permission errors do not crash adapter (Sentry IOBROKER-SIMPLE-API-3)

## 2.4.3 (2020-04-30)
* (Apollon77) Optimize web server error handling

## 2.4.1 (2020-04-23)
* (bluefox) Caught the web server errors

## 2.4.0 (2020-04-12)
* (Apollon77) Add Sentry support with js-controller 3.0
* (Apollon77) fix potential crash

## 2.3.3 (2019-11-16)
* (bluefox) Added response code for unknown commands

## 2.3.2 (2019-10-18)
* (Apollon77) Fix Admin 3 support

## 2.3.1 (2019-10-12)
* (bluefox) Admin 3 is now supported
* (bluefox) NPM packages were updated

## 2.2.0 (2019-09-10)
* (bluefox) New flags are supported: ack and type
* (bluefox) Return error codes as JSON if no pretty print defined

## 2.1.2 (2019-09-05)
* (Apollon77) fix compact mode

## 2.1.0 (2019-07-05)
* (Marco.K) Added command set for the Grafana plugins JSON / SimpleJSON. Usage see https://forum.iobroker.net/topic/23033/aufruf-modifikation-simpleapi-adapter-iobroker-als-datenquelle-f%C3%BCr-grafana

## 2.0.5 (2019-06-26)
* (Apollon77) remove logging

## 2.0.4 (2019-06-23)
* (Apollon77) fix usage as web extension

## 2.0.2 (2018-12-17)
* (Apollon77) fix decoding for state Ids with # in it

## 2.0.0 (2018-06-29)
* (Giermann) BREAKING CHANGE: getBulk is returning data in a different structure

## 1.6.3 (2018-04-15)
* (Apollon77) Return used character encoding (UTF-8)

## 1.6.2 (2017-11-27)
* (Apollon77) Fix decoding problems

## 1.6.1 (2017-09-25)
* (Apollon77) Fix statuscode for setBulk and optimize permission errors

## 1.6.0 (2017-07-10)
* (Apollon77) Fix handling of URL-encoded values, they are now decoded properly
* (Apollon77) Optimize Permission handling
* (Apollon77) add possibility to only allow access to states where user is also owner, finally works correct with js-controller 1.1.1!

## 1.5.0 (2017-03-10)
* (greyhound) Add new POST method setValueFromBody

## 1.4.0 (2017-01-05)
* (bluefox) new web server plugin support

## 1.3.0 (2016-08-30)
* (bluefox) compatible only with new admin

## 1.2.0 (2016-08-27)
* (bluefox) support of letsencrypt certificates

## 1.1.1 (2016-07-06)
* (bluefox) support of chained certificates

## 1.1.0 (2016-02-09)
* (bluefox) fix toggle, objects, states, setBulk, POST
* (bluefox) add tests

## 1.0.0 (2015-09-30)
* (bluefox) stop adapter before update

## 0.1.2 (2015-06-28)
* (bluefox) add description in readme.md
* (bluefox) change "toggle" for boolean and numbers

## 0.1.1 (2015-06-28)
* (bluefox) change setForeignState api
* (bluefox) add type to io-package.json
* (bluefox) enable run from "web"
* (bluefox) add default user

## 0.1.0 (2015-06-10)
* (bluefox) change setForeignState api
* (bluefox) support of user permissions

## 0.0.4 (2015-03-11)
* (bluefox) remove socket.io from file

## 0.0.3 (2015-02-13)
* (bluefox) remove socket.io from dependencies

## 0.0.2 (2015-02-12)
* (bluefox) enable be a part of "web"

## 0.0.1 (2015-02-06)
* (bluefox) initial commit
