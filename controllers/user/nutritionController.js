var axios = require("axios");
var nodemailer = require("nodemailer");
var { ObjectId } = require("mongodb");

var API_KEY = process.env.USDA_API_KEY;


var searchFood = async (foodName) => {

    var response = await axios.get(
        "https://api.nal.usda.gov/fdc/v1/foods/search",
        {
            params: {
                api_key: API_KEY,
                query: foodName,
                pageSize: 5,
                dataType: "Foundation,SR Legacy"
            }
        }
    );

    if (!response.data.foods || response.data.foods.length === 0) {
        return null;
    }

    return response.data.foods[0];
};

var getFoodDetails = async (fdcId) => {

    var response = await axios.get(
        `https://api.nal.usda.gov/fdc/v1/food/${fdcId}`,
        {
            params: {
                api_key: API_KEY
            }
        }
    );

    return response.data;
};

var getNutrient = (nutrients, nutrientId, nameHint) => {

    let nutrient = nutrients.find(item =>
        item.nutrient?.id === nutrientId ||
        item.nutrientId === nutrientId ||
        Number(item.nutrientNumber) === nutrientId ||
        Number(item.nutrient?.number) === nutrientId
    );

    if (!nutrient && nameHint) {
        nutrient = nutrients.find(item => {
            var name = item.nutrient?.name || item.nutrientName || "";
            return name.toLowerCase().includes(nameHint.toLowerCase());
        });
    }

    if (!nutrient) return 0;

    return Number(
        nutrient.amount ??
        nutrient.value ??
        0
    );

};

async function createNutritionLog(req, res) {
    try {

        const db = req.db;

        const {
            foodName,
            mealType,
            grams,
            date
        } = req.body;

        const userId = req.user.id || req.user._id;

        if (
            !foodName ||
            !mealType ||
            !grams ||
            isNaN(grams) ||
            Number(grams) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid food name, meal type, and grams."
            });
        }

        const validMeals = ["Breakfast", "Lunch", "Dinner", "Snack"];

        if (!validMeals.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        const food = await searchFood(foodName);
        if (!food) {
            return res.status(404).json({
                success: false,
                message: "Food not found in USDA database."
            });
        }

        const nutrients = food.foodNutrients || [];

        const caloriesPer100 = getNutrient(nutrients, 1008, "energy");
        const proteinPer100 = getNutrient(nutrients, 1003, "protein");
        const fatPer100 = getNutrient(nutrients, 1004, "fat");
        const carbsPer100 = getNutrient(nutrients, 1005, "carbohydrate");

        const multiplier = Number(grams) / 100;

        const nutrition = {
            userId: new ObjectId(userId),
            fdcId: food.fdcId,
            mealType,
            foodName: food.description,
            grams: Number(grams),
            calories: Number((caloriesPer100 * multiplier).toFixed(2)),
            protein: Number((proteinPer100 * multiplier).toFixed(2)),
            carbs: Number((carbsPer100 * multiplier).toFixed(2)),
            fat: Number((fatPer100 * multiplier).toFixed(2)),
            createdAt: date ? new Date(date) : new Date()
        };

        if (
            nutrition.calories > 0 &&
            nutrition.protein === 0 &&
            nutrition.fat === 0
        ) {
            return res.status(422).json({
                success: false,
                message: "Nutrition data for this food looks incomplete. Try a more specific food name (e.g. 'beef sirloin steak')."
            });
        }

        const result = await db.collection("nutrition_logs").insertOne(nutrition);

        return res.status(201).json({
            success: true,
            message: "Nutrition log added successfully.",
            data: { _id: result.insertedId, ...nutrition }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
async function getTodayNutrition(req, res) {
    try {

        var db = req.db;
        var userId = req.user.id || req.user._id;

        var start = new Date();
        start.setHours(0, 0, 0, 0);

        var end = new Date();
        end.setHours(23, 59, 59, 999);

        var logs = await db.collection("nutrition_logs")
            .find({
                userId: new ObjectId(userId),
                createdAt: {
                    $gte: start,
                    $lte: end
                }
            })
            .toArray();

        var totals = logs.reduce((acc, item) => {

            acc.calories += item.calories || 0;
            acc.protein += item.protein || 0;
            acc.carbs += item.carbs || 0;
            acc.fat += item.fat || 0;

            return acc;

        }, {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        });

        return res.json({
            success: true,
            totals,
            logs
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function getNutritionByDate(req, res) {
    try {

        var db = req.db;
        var userId = req.user.id || req.user._id;
        var { date } = req.params;

        var start = new Date(date);
        start.setHours(0, 0, 0, 0);

        var end = new Date(date);
        end.setHours(23, 59, 59, 999);

        var logs = await db.collection("nutrition_logs")
            .find({
                userId: new ObjectId(userId),
                createdAt: {
                    $gte: start,
                    $lte: end
                }
            })
            .toArray();

        return res.json({
            success: true,
            logs
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function deleteNutritionLog(req, res) {
    try {

        var db = req.db;
        var userId = req.user.id || req.user._id;
        var { id } = req.params;

        var result = await db.collection("nutrition_logs").deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(userId)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Nutrition log not found."
            });
        }

        return res.json({
            success: true,
            message: "Nutrition log deleted successfully."
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function sendDailyNutritionEmail(db, user) {

    var start = new Date();
    start.setHours(0, 0, 0, 0);

    var end = new Date();
    end.setHours(23, 59, 59, 999);

    var logs = await db.collection("nutrition_logs")
        .find({
            userId: new ObjectId(user._id),
            createdAt: {
                $gte: start,
                $lte: end
            }
        })
        .toArray();

    if (!logs.length) return;

    var totals = logs.reduce((acc, item) => {

        acc.calories += item.calories || 0;
        acc.protein += item.protein || 0;
        acc.carbs += item.carbs || 0;
        acc.fat += item.fat || 0;

        return acc;

    }, {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    });

    let rows = "";

    logs.forEach(log => {
        rows += `
            <tr>
                <td>${log.mealType}</td>
                <td>${log.foodName}</td>
                <td>${log.grams}g</td>
                <td>${log.calories}</td>
                <td>${log.protein}</td>
                <td>${log.carbs}</td>
                <td>${log.fat}</td>
            </tr>
        `;
    });

    var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    var html = `
        <h2>Daily Nutrition Summary</h2>

        <table border="1" cellpadding="8" cellspacing="0">
            <tr>
                <th>Meal</th>
                <th>Food</th>
                <th>Quantity</th>
                <th>Calories</th>
                <th>Protein</th>
                <th>Carbs</th>
                <th>Fat</th>
            </tr>

            ${rows}
        </table>

        <h3>Totals</h3>

        <ul>
            <li><b>Calories:</b> ${totals.calories.toFixed(2)} kcal</li>
            <li><b>Protein:</b> ${totals.protein.toFixed(2)} g</li>
            <li><b>Carbs:</b> ${totals.carbs.toFixed(2)} g</li>
            <li><b>Fat:</b> ${totals.fat.toFixed(2)} g</li>
        </ul>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Your Daily Nutrition Report",
        html
    });
}

async function sendAllDailyNutritionEmails(db) {

    var users = await db.collection('users').find({ isVerified: true }).toArray();

    for (var user of users) {
        try {
            await sendDailyNutritionEmail(db, user);
            console.log(`[NUTRITION EMAIL SENT] to ${user.email}`);
        } catch (err) {
            console.error(`Failed to send nutrition email to ${user.email}:`, err);
        }
    }
}
async function getNutritionHistory(req, res) {
    try {
        var db = req.db;
        var userId = req.user.id || req.user._id;

        var days = await db.collection('nutrition_logs').aggregate([
            { $match: { userId: new ObjectId(userId) } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    calories: { $sum: "$calories" },
                    protein: { $sum: "$protein" },
                    carbs: { $sum: "$carbs" },
                    fat: { $sum: "$fat" }
                }
            },
            { $sort: { _id: -1 } }
        ]).toArray();

        res.json({ success: true, days });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
module.exports = {
    createNutritionLog,
    getTodayNutrition,
    getNutritionByDate,
    deleteNutritionLog,
    sendDailyNutritionEmail,
    sendAllDailyNutritionEmails,
    getNutritionHistory
};