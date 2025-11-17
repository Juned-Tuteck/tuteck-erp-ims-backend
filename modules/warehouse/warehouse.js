const db = require("../../config/database");
const xlsx = require("xlsx");

const CREATED_BY = "00000000-0000-0000-0000-000000000000";

const warehouseController = {
  // Get all warehouses
  async getAll(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM ims.t_warehouse WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC"
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Data fetched successfully",
        devMessage: "Warehouses retrieved successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Get warehouse by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        "SELECT * FROM ims.t_warehouse WHERE id = $1 AND is_active = true AND is_deleted = false",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Warehouse not found",
          devMessage: "No warehouse found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data fetched successfully",
        devMessage: "Warehouse retrieved successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Create warehouse
  async create(req, res) {
    const client = await db.getClient();
    try {
      const { warehouse_name, address , is_virtual } = req.body;

      await client.query("BEGIN");

      // Insert into ims.t_warehouse
      const warehouseResult = await client.query(
        `INSERT INTO ims.t_warehouse (warehouse_name, address, is_virtual, created_by) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [warehouse_name, address, is_virtual, CREATED_BY]
      );

      const warehouse = warehouseResult.rows[0];
      const warehouse_id = warehouse.id;

      // Insert into pms.t_project
      const project_species = "project warehouse";
      const project_name = `${warehouse_name} project`;
      const created_at = new Date();

      const projectResult = await client.query(
        `INSERT INTO pms.t_project (warehouse_id, project_species, name, created_by, created_at) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [warehouse_id, project_species, project_name, CREATED_BY, created_at]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: {
          warehouse: warehouse,
          project: projectResult.rows[0],
        },
        clientMessage: "Data inserted successfully",
        devMessage: "Warehouse and project created successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    } finally {
      client.release();
    }
  },

  // Update warehouse (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;

      const validFields = {};
      Object.keys(updateFields).forEach((key) => {
        if (updateFields[key] !== null && updateFields[key] !== undefined) {
          validFields[key] = updateFields[key];
        }
      });

      if (Object.keys(validFields).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "No valid fields to update",
          devMessage: "Request body contains no valid update fields",
        });
      }

      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(", ");
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_warehouse SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Warehouse not found",
          devMessage: "No warehouse found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data updated successfully",
        devMessage: "Warehouse updated successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Delete warehouse (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE ims.t_warehouse SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Warehouse not found",
          devMessage: "No warehouse found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data deleted successfully",
        devMessage: "Warehouse deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Bulk insert warehouses and create projects
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const warehouses = req.body;
      const insertedData = [];

      for (const warehouse of warehouses) {
        const { warehouse_name, address } = warehouse;

        // Insert into ims.t_warehouse
        const warehouseResult = await client.query(
          `INSERT INTO ims.t_warehouse (warehouse_name, address, created_by) 
           VALUES ($1, $2, $3) RETURNING *`,
          [warehouse_name, address, CREATED_BY]
        );

        const insertedWarehouse = warehouseResult.rows[0];
        const warehouse_id = insertedWarehouse.id;

        // Insert into pms.t_project
        const project_species = "project warehouse";
        const project_name = `${warehouse_name} project`;
        const created_at = new Date();

        const projectResult = await client.query(
          `INSERT INTO pms.t_project (warehouse_id, project_species, name, created_by, created_at) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [warehouse_id, project_species, project_name, CREATED_BY, created_at]
        );

        insertedData.push({
          warehouse: insertedWarehouse,
          project: projectResult.rows[0],
        });
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedData,
        clientMessage: "Bulk data inserted successfully",
        devMessage: `${insertedData.length} warehouses and projects inserted successfully`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    } finally {
      client.release();
    }
  },

  // Process uploaded Excel and bulk insert warehouses
  async processExcelAndBulkInsert(req, res) {
    const client = await db.getClient();
    try {
      // Check if a file is uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "No file uploaded",
          devMessage: "Excel file is required for processing",
        });
      }

      // Read the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });

      if (sheetData.length <= 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "Excel file is empty or has no data rows",
          devMessage: "No data found in the uploaded Excel file",
        });
      }

      const headers = sheetData[0].map((header) => header.trim().toLowerCase());
      const rows = sheetData.slice(1);

      const warehouseNameIndex = headers.indexOf("warehouse name");
      const addressIndex = headers.indexOf("address");

      if (warehouseNameIndex === -1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "Warehouse Name column is missing",
          devMessage:
            "Warehouse Name column not found in the uploaded Excel file",
        });
      }

      await client.query("BEGIN");
      const insertedWarehouses = [];
      const insertedProjects = [];

      let currentTimestamp = new Date(); // Start with the current timestamp

      for (const row of rows) {
        const warehouse_name = row[warehouseNameIndex]?.trim();
        const address = row[addressIndex]?.trim();

        if (!warehouse_name) {
          throw new Error("Warehouse Name is required in each row");
        }

        const created_at = currentTimestamp
          .toISOString()
          .replace("T", " ")
          .replace("Z", " +0000");
        currentTimestamp = new Date(currentTimestamp.getTime() + 10); // Increment by 1 millisecond

        const result = await client.query(
          `INSERT INTO ims.t_warehouse (warehouse_name, address, created_by, created_at) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [warehouse_name, address, CREATED_BY, created_at]
        );

          // Insert into pms.t_project
        const project_species = "project warehouse";
        const project_name = `${warehouse_name} project`;

        const projectResult = await client.query(
          `INSERT INTO pms.t_project (warehouse_id, project_species, name, created_by, created_at) 
          VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [result.rows[0].id, project_species, project_name, CREATED_BY, created_at]
        );
        insertedProjects.push(projectResult.rows[0]);
        insertedWarehouses.push(result.rows[0]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: { warehouses: insertedWarehouses, projects: insertedProjects },
        clientMessage: "Excel data processed and inserted successfully",
        devMessage: `${insertedWarehouses.length} warehouses inserted with ${insertedProjects.length} projects successfully`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    } finally {
      client.release();
    }
  },

  // Export all warehouses to Excel
  async exportToExcel(req, res) {
    try {
      // Fetch all warehouse data
      const result = await db.query(
        "SELECT id, warehouse_code, warehouse_name, address, is_active, is_deleted FROM ims.t_warehouse ORDER BY created_at DESC"
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "No warehouse data found",
          devMessage: "No data available in the warehouse table",
        });
      }

      // Prepare Excel data
      const headers = [
        "ID",
        "Warehouse Code",
        "Warehouse Name",
        "Address",
        "Is Active",
        "Is Deleted",
      ];

      const rows = result.rows.map((row) => [
        row.id,
        row.warehouse_code,
        row.warehouse_name,
        row.address,
        row.is_active ? "Yes" : "No",
        row.is_deleted ? "Yes" : "No",
      ]);

      // Create a new workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

      // Append the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, "Warehouses");

      // Write the workbook to a buffer
      const excelBuffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      // Set response headers for file download
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="warehouses.xlsx"'
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      // Send the Excel file as a response
      return res.status(200).send(excelBuffer);
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Get all projects with project_species = 'project warehouse'
  async getAllProjects(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM pms.t_project WHERE project_species = 'project warehouse'"
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Projects fetched successfully",
        devMessage: "Projects retrieved successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },
};

module.exports = warehouseController;
