import pool from "../db/db";
import { AppError } from "../errors";
import { Order } from "../types/invoice";

export async function getOrderById(orderId: string): Promise<Order> {
    const result = await pool.query(
        `SELECT order_data FROM orders WHERE orderID = $1`,
        [orderId]
    );

    if (result.rows.length === 0) {
        throw new AppError("NOT_FOUND", `Order with id ${orderId} not found`);
    }

    return result.rows[0].order_data;
}