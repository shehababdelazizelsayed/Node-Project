const logger = require("./logger");

const requestLogger = (req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    body: req.body,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  const originalSend = res.send;
  res.send = function (body) {
    logger.info({
      response: {
        statusCode: res.statusCode,
        body: body,
        timestamp: new Date().toISOString(),
      },
    });
    originalSend.call(this, body);
  };

  next();
};

module.exports = { requestLogger };
