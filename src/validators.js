import Joi from 'joi';

const createOrgSchema = Joi.object({
  organization_name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Organization name is required',
    'string.min': 'Organization name must be at least 2 characters',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Valid email is required',
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.min': 'Password must be at least 6 characters',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Valid email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

const updateOrgSchema = Joi.object({
  organization_name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
});

const deleteOrgSchema = Joi.object({
  organization_name: Joi.string().min(2).max(100).required(),
});

const getOrgSchema = Joi.object({
  organization_name: Joi.string().min(2).max(100).required(),
});

function validateRequest(schema) {
  return (req, res, next) => {
    const source = req.body.organization_name ? req.body : req.query;
    const { error, value } = schema.validate(source, { abortEarly: false });

    if (error) {
      const details = error.details.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details,
        },
      });
    }

    req.validatedData = value;
    next();
  };
}

export {
  createOrgSchema,
  loginSchema,
  updateOrgSchema,
  deleteOrgSchema,
  getOrgSchema,
  validateRequest,
};
