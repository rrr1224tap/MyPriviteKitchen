const cloud = require('wx-server-sdk')
const { createManageDishHandler } = require('./dish-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function findDishById(dishId) {
  const byDishId = await db.collection('dishes')
    .where({
      dish_id: dishId
    })
    .limit(1)
    .get()

  if (byDishId.data && byDishId.data.length) {
    return byDishId.data[0]
  }

  const byDocumentId = await db.collection('dishes')
    .doc(dishId)
    .get()
    .catch(() => null)

  return byDocumentId && byDocumentId.data ? byDocumentId.data : null
}

async function findCategoryById(categoryId) {
  const byCategoryId = await db.collection('categories')
    .where({
      category_id: categoryId
    })
    .limit(1)
    .get()

  if (byCategoryId.data && byCategoryId.data.length) {
    return byCategoryId.data[0]
  }

  const byDocumentId = await db.collection('categories')
    .doc(categoryId)
    .get()
    .catch(() => null)

  return byDocumentId && byDocumentId.data ? byDocumentId.data : null
}

exports.main = createManageDishHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  now: () => new Date(),

  createDishId: () => {
    return `dish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  },

  findMerchantStaff: async ({ merchant_id, openid }) => {
    const result = await db.collection('merchant_staff')
      .where({
        merchant_id,
        openid,
        status: 'active'
      })
      .limit(1)
      .get()

    return result.data && result.data.length ? result.data[0] : null
  },

  findDishesByMerchantId: async (merchantId) => {
    const result = await db.collection('dishes')
      .where({
        merchant_id: merchantId
      })
      .orderBy('sort_order', 'asc')
      .limit(1000)
      .get()

    return result.data || []
  },

  findDishById,

  findDishesByIds: async (dishIds) => {
    const result = await db.collection('dishes')
      .where({
        dish_id: _.in(dishIds)
      })
      .limit(1000)
      .get()

    return result.data || []
  },

  findCategoryById,

  getNextSortOrder: async (merchantId) => {
    const result = await db.collection('dishes')
      .where({
        merchant_id: merchantId
      })
      .orderBy('sort_order', 'desc')
      .limit(1)
      .get()

    if (!result.data || !result.data.length) {
      return 1
    }

    return (Number(result.data[0].sort_order) || 0) + 1
  },

  createDish: async (dish) => {
    const result = await db.collection('dishes')
      .add({
        data: dish
      })

    return {
      _id: result._id,
      ...dish
    }
  },

  updateDish: async ({ dish_id, updateData }) => {
    const result = await db.collection('dishes')
      .where({
        dish_id
      })
      .update({
        data: updateData
      })

    if (!result.stats || result.stats.updated < 1) {
      throw new Error('DISH_UPDATE_FAILED')
    }

    return {
      dish_id,
      ...updateData
    }
  },

  updateDishSortList: async (items) => {
    const results = await Promise.all(items.map((item) => {
      return db.collection('dishes')
        .where({
          dish_id: item.dish_id
        })
        .update({
          data: {
            sort_order: item.sort_order,
            updated_at: item.updated_at
          }
        })
    }))

    const updatedCount = results.reduce((total, result) => {
      return total + (result.stats ? result.stats.updated : 0)
    }, 0)

    if (updatedCount !== items.length) {
      throw new Error('DISH_SORT_UPDATE_FAILED')
    }

    return updatedCount
  },

  logger: console
})
