import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.businessbuddy.app",
  appName: "BusinessBuddy",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
