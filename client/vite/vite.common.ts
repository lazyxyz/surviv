import { svelte } from "@sveltejs/vite-plugin-svelte";
import path, { resolve } from "path";
import { type UserConfig } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import pkg from "../../package.json";
import { importPathsPlugin } from "./import-paths-plugin/import-paths-plugin";

const commonConfig: UserConfig = {
    server: {
        port: 3000,
        host: "0.0.0.0"
    },
    preview: {
        port: 3000,
        host: "0.0.0.0"
    },
    build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "../index.html"),
                changelog: resolve(__dirname, "../changelog/index.html"),
                news: resolve(__dirname, "../news/index.html"),
                earn: resolve(__dirname, "../earn/index.html"),
                rules: resolve(__dirname, "../rules/index.html"),
                editor: resolve(__dirname, "../editor/index.html"),
                wiki: resolve(__dirname, "../wiki/index.html")
            },
            output: {
                assetFileNames(assetInfo) {
                    let path = "assets";
                    switch (assetInfo.names[0].split(".").at(-1)) {
                        case "css":
                            path = "styles";
                            break;
                        case "ttf":
                        case "woff2":
                            path = "fonts";
                    }
                    return `${path}/[name]-[hash][extname]`;
                },
                entryFileNames: "scripts/[name]-[hash].js",
                chunkFileNames: "scripts/[name]-[hash].js",
                manualChunks(id, _chunkInfo) {
                    if (id.includes("node_modules")) {
                        return "vendor";
                    }
                }
            }
        }
    },

    plugins: [
        svelte({
            compilerOptions: {
                warningFilter(warning) {
                    // we dont care about accessibility warnings on the building editor lmao
                    if (warning.code.includes("a11y")) return false;
                    return true;
                }
            }
        }),
        ViteImageOptimizer({
            test: /\.(svg)$/i,
            logStats: false
        }),
        importPathsPlugin({
            folders: ["public/audio/game/"],
            moduleName: "game-sounds"
        })
    ],

    css: {
        preprocessorOptions: {
            scss: {
                api: "modern-compiler"
            }
        }
    },

    resolve: {
        alias: {
            "@common": path.resolve(__dirname, "../../common/src")
        }
    },

    define: {
        APP_VERSION: JSON.stringify(pkg.version)
    }
};

export default commonConfig;
