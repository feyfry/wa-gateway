const Joi = require('joi');

const messageSchema = Joi.object({
  to: Joi.string().required().min(10).max(20),
  message: Joi.string().required().max(4096),
  options: Joi.object({
    delay: Joi.number().min(0).max(60000).default(0)
  }).optional()
});

const bulkMessageSchema = Joi.object({
  recipients: Joi.array().items(Joi.string().min(10).max(20)).min(1).max(100).required(),
  message: Joi.string().required().max(4096),
  options: Joi.object({
    delay: Joi.number().min(1000).max(60000).default(2000)
  }).optional()
});

function validateMessage(data) {
  return messageSchema.validate(data);
}

function validateBulkMessage(data) {
  return bulkMessageSchema.validate(data);
}

module.exports = {
  validateMessage,
  validateBulkMessage
};