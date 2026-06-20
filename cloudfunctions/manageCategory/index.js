const cloud = require('wx-server-sdk')
const { createManageCategoryHandler } = require('./category-service')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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

exports.main = createManageCategoryHandler({
  getOpenid: () => {
    const wxContext = cloud.getWXContext()
    return wxContext.OPENID || ''
  },

  now: () => new Date(),

  createCategoryId: () => {
    return `category_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

  findCategoriesByMerchantId: async (merchantId) => {
    const result = await db.collection('categories')
      .where({
        merchant_id: merchantId
      })
      .orderBy('sort_order', 'asc')
      .limit(1000)
      .get()

    return result.data || []
  },

  findCategoryById,

  findCategoriesByIds: async (categoryIds) => {
    const result = await db.collection('categories')
      .where({
        category_id: _.in(categoryIds)
      })
      .limit(1000)
      .get()

    return result.data || []
  },

  getNextSortOrder: async (merchantId) => {
    const result = await db.collection('categories')
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

  createCategory: async (category) => {
    const result = await db.collection('categories')
      .add({
        data: category
      })

    return {
      _id: result._id,
      ...category
    }
  },

  updateCategory: async ({ category_id, updateData }) => {
    const result = await db.collection('categories')
      .where({
        category_id
      })
      .update({
        data: updateData
      })

    if (!result.stats || result.stats.updated < 1) {
      throw new Error('CATEGORY_UPDATE_FAILED')
    }

    return {
      category_id,
      ...updateData
    }
  },

  updateCategorySortList: async (items) => {
    const results = await Promise.all(items.map((item) => {
      return db.collection('categories')
        .where({
          category_id: item.category_id
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
      throw new Error('CATEGORY_SORT_UPDATE_FAILED')
    }

    return updatedCount
  },

  logger: console
})
