const db = require('../../config/database');
const xlsx = require('xlsx');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const categoryController = {
  // Get all categories
  async getAll(req, res) {
    try {
      const { parent } = req.query;
      let query = `
        SELECT c.*, b.brand_name, b.id as brand_id
        FROM ims.t_category c
        LEFT JOIN ims.t_brand b ON c.brand_id = b.id
        WHERE c.is_active = true AND c.is_deleted = false`;
      const params = [];
      if (parent === 'true') {
        query += ' AND c.parent_category_id IS NULL';
      }
      query += ' ORDER BY c.created_at DESC';

      const result = await db.query(query, params);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'Categories retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Get category by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_category WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'Category retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Create category
  async create(req, res) {
    try {
      const { category_name, parent_category_id, brand_id, description } = req.body;
      // Make parent_category_id and description optional
      const parentId = parent_category_id !== undefined ? parent_category_id : null;
      const desc = description !== undefined ? description : null;

      const result = await db.query(
        `INSERT INTO ims.t_category (category_name, parent_category_id, brand_id, description, created_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [category_name, parentId, brand_id, desc, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'Category created successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Update category (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      
      const validFields = {};
      Object.keys(updateFields).forEach(key => {
        if (updateFields[key] !== null && updateFields[key] !== undefined) {
          validFields[key] = updateFields[key];
        }
      });

      if (Object.keys(validFields).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'No valid fields to update',
          devMessage: 'Request body contains no valid update fields'
        });
      }

      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_category SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'Category updated successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Delete category (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_category SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'Category deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Bulk insert categories
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const categories = req.body;
      const insertedCategories = [];

      for (const category of categories) {
        const { category_name, parent_category_id, brand_id, description } = category;
        // Make parent_category_id and description optional
        const parentId = parent_category_id !== undefined ? parent_category_id : null;
        const desc = description !== undefined ? description : null;
        const result = await client.query(
          `INSERT INTO ims.t_category (category_name, parent_category_id, brand_id, description, created_by) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [category_name, parentId, brand_id, desc, CREATED_BY]
        );
        insertedCategories.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedCategories,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedCategories.length} categories inserted successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    } finally {
      client.release();
    }
  },

  // Process uploaded Excel and bulk insert categories
  async processExcelAndBulkInsert(req, res) {
    const client = await db.getClient();
    try {
      // Check if a file is uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'No file uploaded',
          devMessage: 'Excel file is required for processing'
        });
      }

      // Read the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      if (sheetData.length <= 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'Excel file is empty or has no data rows',
          devMessage: 'No data found in the uploaded Excel file'
        });
      }

      const headers = sheetData[0].map(header => header.trim().toLowerCase());
      console.log('Headers:', headers); // Debugging line to check headers
      const rows = sheetData.slice(1);

      const categoryNameIndex = headers.indexOf('category name');
      const brandIdIndex = headers.indexOf('brand id');
      const descriptionIndex = headers.indexOf('description');
      const parentCategoryIdIndex = headers.indexOf('parent category id');

      if (categoryNameIndex === -1 || brandIdIndex === -1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'Required columns are missing',
          devMessage: 'category_name and brand_id columns are required in the uploaded Excel file'
        });
      }

      await client.query('BEGIN');
      const insertedCategories = [];

      let currentTimestamp = new Date(); // Start with the current timestamp

      for (const row of rows) {
        const category_name = row[categoryNameIndex]?.trim();
        const brand_id = row[brandIdIndex]?.trim();
        const description = row[descriptionIndex]?.trim();
        const parent_category_id = row[parentCategoryIdIndex]?.trim();

        if (!category_name || !brand_id) {
          throw new Error('category_name and brand_id are required in each row');
        }

        const desc = description !== undefined ? description : null;
        const parentId = parent_category_id !== undefined ? parent_category_id : null;
        const created_at = currentTimestamp.toISOString().replace('T', ' ').replace('Z', ' +0000');
        currentTimestamp = new Date(currentTimestamp.getTime() + 10); // Increment by 1 millisecond

        const result = await client.query(
          `INSERT INTO ims.t_category (category_name, brand_id, description, parent_category_id, created_by, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [category_name, brand_id, desc, parentId, CREATED_BY, created_at]
        );
        insertedCategories.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedCategories,
        clientMessage: 'Excel data processed and inserted successfully',
        devMessage: `${insertedCategories.length} categories inserted successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    } finally {
      client.release();
    }
  },

  // Export all categories to Excel
  async exportToExcel(req, res) {
    try {
      // Fetch all category data
      const result = await db.query(
        `SELECT id, category_code, category_name, parent_category_id, brand_id, description, is_deleted, is_active 
         FROM ims.t_category ORDER BY created_at DESC`
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'No category data found',
          devMessage: 'No data available in the category table'
        });
      }

      // Prepare Excel data
      const headers = [
        'ID',
        'Category Code',
        'Category Name',
        'Parent Category ID',
        'Brand ID',
        'Description',
        'Is Deleted',
        'Is Active'
      ];

      const rows = result.rows.map(row => [
        row.id,
        row.category_code,
        row.category_name,
        row.parent_category_id,
        row.brand_id,
        row.description,
        row.is_deleted ? 'Yes' : 'No',
        row.is_active ? 'Yes' : 'No'
      ]);

      // Create a new workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Append the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Categories');

      // Write the workbook to a buffer
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      res.setHeader('Content-Disposition', 'attachment; filename="categories.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Send the Excel file as a response
      return res.status(200).send(excelBuffer);
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  }
};

module.exports = categoryController;