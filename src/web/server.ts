import { analyseGrowthDynamics } from "../analytics";
import dashboard from "./dashboard.html";
import fs from "fs";

function dataHasChanged(newData: any, filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return true;
  }

  try {
    const existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Compare everything except exportDate
    const { exportDate: newExportDate, ...newDataWithoutDate } = newData;
    const { exportDate: existingExportDate, ...existingDataWithoutDate } =
      existingData;

    return (
      JSON.stringify(newDataWithoutDate) !==
      JSON.stringify(existingDataWithoutDate)
    );
  } catch (error) {
    return true; // If we can't read/parse existing file, treat as changed
  }
}

export async function startDashboardServer() {
  console.log(
    "🚀 Starting Entrepreneurship & Technical Debt Analytics Dashboard..."
  );

  const server = Bun.serve({
    port: 3000,
    routes: {
      "/": dashboard,

      "/api/analytics": async () => {
        try {
          const data = await analyseGrowthDynamics();

          // Save JSON data to file for inspection and static hosting (only save if changed)
          const filePath = "data/analytics-results-data.json";
          if (dataHasChanged(data, filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(
              "📝 Analytics data updated at data/analytics-results-data.json"
            );
          }

          return Response.json(data);
        } catch (error) {
          console.error("Entrepreneurship analytics error:", error);
          return Response.json(
            { error: "Failed to calculate entrepreneurship analytics" },
            { status: 500 }
          );
        }
      },
      "/api/*": () =>
        Response.json({ error: "API endpoint not found" }, { status: 404 }),
    },

    fetch(request) {
      return new Response("Not Found", { status: 404 });
    },

    error(error) {
      console.error("Server error:", error);
      return new Response("Internal Server Error", { status: 500 });
    },
  });

  console.log(`✅ Entrepreneurship Analytics Dashboard: ${server.url}`);

  return new Promise((resolve) => {
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down dashboard...");
      server.stop();
      resolve(undefined);
    });
  });
}
