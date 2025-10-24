const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bookstore API',
      version: '1.0.0',
      description: 'API for managing books, users, carts, orders, and reviews',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        BookWithExtras: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            Title: { type: 'string' },
            Author: { type: 'string' },
            Price: { type: 'number' },
            Description: { type: 'string' },
            Stock: { type: 'integer' },
            Image: { type: 'string', format: 'uri' },
            Category: { type: 'string' },
            Pdf: { type: 'string', format: 'uri' },
            Owner: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            Reviews: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  User: { type: 'object', properties: { Name: { type: 'string' } } },
                  Rating: { type: 'number' },
                  Review: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            stats: {
              type: 'object',
              properties: {
                avgRating: { type: 'number' },
                reviewsCount: { type: 'integer' },
                isDefaultAvg: { type: 'boolean' },
              },
            },
            lastReview: {
              type: 'object',
              properties: {
                rating: { type: 'number' },
                review: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                userName: { type: 'string' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './Controllers/*.js', './index.js'], // Paths to files containing OpenAPI definitions
};

const specs = swaggerJSDoc(options);

module.exports = { swaggerUi, specs };
