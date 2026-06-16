const cloud = require('wx-server-sdk')
const { createGetDishDetailHandler } = require('./dish-detail-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function findOne(collectionName, where) {
  const result = await db.collection(collectionName).where(where).limit(1).get()
  return result.data[0] || null
}

async function findDishById(dishId) {
  const byDocumentId = await findOne('dishes', { _id: dishId })

  if (byDocumentId) {
    return byDocumentId
  }

  return findOne('dishes', { dish_id: dishId })
}

async function findCategoryById(categoryId, merchantId) {
  if (!categoryId) {
    return null
  }

  const byDocumentId = await findOne('categories', {
    _id: categoryId,
    merchant_id: merchantId
  })

  if (byDocumentId) {
    return byDocumentId
  }

  return findOne('categories', {
    category_id: categoryId,
    merchant_id: merchantId
  })
}

async function findDishIngredientLinks(dishId, merchantId) {
  const result = await db
    .collection('dish_ingredients')
    .where({
      dish_id: dishId,
      merchant_id: merchantId
    })
    .limit(1000)
    .get()

  return result.data || []
}

async function findIngredientsByIds(ingredientIds, merchantId) {
  if (!ingredientIds.length) {
    return []
  }

  const result = await db
    .collection('ingredients')
    .where({
      merchant_id: merchantId,
      ingredient_id: _.in(ingredientIds)
    })
    .limit(1000)
    .get()

  return result.data || []
}

async function findProductionSteps(dishId, merchantId) {
  const result = await db
    .collection('production_steps')
    .where({
      dish_id: dishId,
      merchant_id: merchantId
    })
    .orderBy('step_index', 'asc')
    .limit(1000)
    .get()

  return result.data || []
}

exports.main = createGetDishDetailHandler({
  findDishById,
  findCategoryById,
  findDishIngredientLinks,
  findIngredientsByIds,
  findProductionSteps,
  logError: console.error
})
