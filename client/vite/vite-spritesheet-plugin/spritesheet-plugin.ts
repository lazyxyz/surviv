import { watch } from "chokidar";
import { Minimatch } from "minimatch";
import path, { resolve } from "path";
import { type SpritesheetData } from "pixi.js";
import { type FSWatcher, type Plugin, type ResolvedConfig } from "vite";
import readDirectory from "./utils/readDirectory.js";
import { type CompilerOptions, createSpritesheets, type MultiResAtlasList } from "./utils/spritesheet.js";
import { GameConstants } from "../../../common/src/constants";
import { Mode, Modes } from "../../../common/src/definitions/modes";
import { mkdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";

const PLUGIN_NAME = "vite-spritesheet-plugin";

export const getCacheDir = (modeName: string) => `.spritesheet-cache-${modeName}`;

export type CacheData = {
    lastModified: number
    fileMap: Record<string, string>
    atlasFiles: {
        low: string[]
        high: string[]
    }
};

const defaultGlob = "**/*.{png,gif,jpg,bmp,tiff,svg}";
const imagesMatcher = new Minimatch(defaultGlob);

const compilerOpts = {
    outputFormat: "png",
    outDir: "atlases",
    margin: 8,
    removeExtensions: true,
    maximumSize: 4096,
    name: "atlas",
    packerOptions: {}
} satisfies CompilerOptions as CompilerOptions;

const getImageDirs = (modeName: Mode | "shared", imageDirs: string[] = []): string[] => {
    imageDirs.push(`public/img/game/${modeName}`);
    return modeName === "shared"
        ? imageDirs
        : getImageDirs(Modes[modeName].inheritTexturesFrom ?? "shared", imageDirs);
};

const imageDirs = getImageDirs(GameConstants.modeName).reverse();

async function buildSpritesheets(modeName: Mode | "shared"): Promise<MultiResAtlasList> {
    const cacheDir = getCacheDir(modeName);
    const imageDirs = getImageDirs(modeName).reverse();
    const fileMap = new Map<string, { lastModified: number, path: string }>();

    for (const imagePath of imageDirs.map(dir => readDirectory(dir).filter(x => imagesMatcher.match(x))).flat()) {
        const imageFileInfo = await stat(imagePath);
        const { mtime, ctime } = imageFileInfo;
        fileMap.set(imagePath.slice(imagePath.lastIndexOf(path.sep)), {
            path: imagePath,
            lastModified: Math.max(mtime.getTime(), ctime.getTime())
        });
    }

    let isCached = true;
    if (!existsSync(cacheDir)) {
        await mkdir(cacheDir);
        isCached = false;
    }
    if (!existsSync(path.join(cacheDir, "data.json"))) isCached = false;

    let cacheData: CacheData = {
        lastModified: 0,
        fileMap: {},
        atlasFiles: { low: [], high: [] }
    };

    if (isCached) {
        console.log(`Spritesheets for mode ${modeName} are cached and valid! Skipping build.`);
        return {
            low: await Promise.all(cacheData.atlasFiles.low.map(async file => ({
                json: JSON.parse(await readFile(path.join(cacheDir, `${file}.json`), "utf8")) as SpritesheetData,
                image: await readFile(path.join(cacheDir, `${file}.png`))
            }))),
            high: await Promise.all(cacheData.atlasFiles.high.map(async file => ({
                json: JSON.parse(await readFile(path.join(cacheDir, `${file}.json`), "utf8")) as SpritesheetData,
                image: await readFile(path.join(cacheDir, `${file}.png`))
            })))
        };
    }

    console.log(`Building spritesheets for mode ${modeName}...`);

    return await createSpritesheets(fileMap, compilerOpts, modeName);
}
const getHighResVirtualModuleId = (modeName: string) => `virtual:spritesheets-jsons-high-res-${modeName}`;
const getHighResResolvedVirtualModuleId = (modeName: string) => `\0${getHighResVirtualModuleId(modeName)}`;

const getLowResVirtualModuleId = (modeName: string) => `virtual:spritesheets-jsons-low-res-${modeName}`;
const getLowResResolvedVirtualModuleId = (modeName: string) => `\0${getLowResVirtualModuleId(modeName)}`;

const resolveId = (id: string): string | undefined => {
    const modes = ["fall", "winter", "normal", "shared"];
    for (const mode of modes) {
        const highResId = getHighResVirtualModuleId(mode);
        const lowResId = getLowResVirtualModuleId(mode);
        if (id === highResId) return getHighResResolvedVirtualModuleId(mode);
        if (id === lowResId) return getLowResResolvedVirtualModuleId(mode);
    }
    return undefined;
};


export function spritesheet(): Plugin[] {
    let watcher: FSWatcher;
    let config: ResolvedConfig;

    const atlasesByMode: Record<string, MultiResAtlasList> = {};
    const exportedAtlasesByMode: Record<string, { low: SpritesheetData[], high: SpritesheetData[] }> = {
        fall: { low: [], high: [] },
        winter: { low: [], high: [] },
        normal: { low: [], high: [] },
        shared: { low: [], high: [] }
    };

    const load = (id: string): string | undefined => {
        const modes = ["fall", "winter", "normal", "shared"];
        for (const mode of modes) {
            if (id === getHighResResolvedVirtualModuleId(mode)) {
                return `
                export const atlases = ${JSON.stringify(exportedAtlasesByMode[mode].high)};
            `;
            }
            if (id === getLowResResolvedVirtualModuleId(mode)) {
                return `
                export const atlases = ${JSON.stringify(exportedAtlasesByMode[mode].low)};
            `;
            }
        }
        return undefined;
    };

    let buildTimeout: NodeJS.Timeout | undefined;

    return [
        {
            name: `${PLUGIN_NAME}:build`,
            apply: "build",
            async buildStart() {
                for (const mode of ["fall", "winter", "shared"]) {
                    const atlases = await buildSpritesheets(mode);
                    atlasesByMode[mode] = atlases;
                    exportedAtlasesByMode[mode].high = atlasesByMode[mode].high.map(sheet => sheet.json);
                    exportedAtlasesByMode[mode].low = atlasesByMode[mode].low.map(sheet => sheet.json);
                }
            },
            generateBundle() {
                for (const mode of ["fall", "winter", "normal", "shared"]) {
                    for (const sheet of [...atlasesByMode[mode].low, ...atlasesByMode[mode].high]) {
                        this.emitFile({
                            type: "asset",
                            fileName: sheet.json.meta.image,
                            source: sheet.image
                        });
                    }
                }
                this.info("Built spritesheets for all modes");
            },
            resolveId,
            load
        },
        {
            name: `${PLUGIN_NAME}:serve`,
            apply: "serve",
            configResolved(cfg) {
                config = cfg;
            },
            async configureServer(server) {
                function reloadPage(): void {
                    clearTimeout(buildTimeout);

                    buildTimeout = setTimeout(() => {
                        buildSheets().then(() => {
                            for (const mode of ["fall", "winter", "normal", "shared"]) {
                                const moduleHigh = server.moduleGraph.getModuleById(getHighResResolvedVirtualModuleId(mode));
                                if (moduleHigh !== undefined) void server.reloadModule(moduleHigh);
                                const moduleLow = server.moduleGraph.getModuleById(getLowResResolvedVirtualModuleId(mode));
                                if (moduleLow !== undefined) void server.reloadModule(moduleLow);
                            }
                        }).catch(e => console.error(e));
                    }, 500);
                }

                watcher = watch(imageDirs.map(pattern => resolve(pattern, defaultGlob)), {
                    cwd: config.root,
                    ignoreInitial: true
                })
                    .on("add", reloadPage)
                    .on("change", reloadPage)
                    .on("unlink", reloadPage);

                const files = new Map<string, Buffer | string>();

                async function buildSheets(): Promise<void> {
                    for (const mode of ["fall", "winter", "normal", "shared"]) {
                        atlasesByMode[mode] = await buildSpritesheets(mode);
                        exportedAtlasesByMode[mode].high = atlasesByMode[mode].high.map(sheet => sheet.json);
                        exportedAtlasesByMode[mode].low = atlasesByMode[mode].low.map(sheet => sheet.json);

                        for (const sheet of [...atlasesByMode[mode].low, ...atlasesByMode[mode].high]) {
                            files.set(sheet.json.meta.image!, sheet.image);
                        }
                    }
                }

                await buildSheets();
                return () => {
                    server.middlewares.use((req, res, next) => {
                        if (req.originalUrl === undefined) return next();

                        // Set CORS headers for all responses
                        res.setHeader("Access-Control-Allow-Origin", "*");
                        res.setHeader("Access-Control-Allow-Methods", "GET");

                        const file = files.get(req.originalUrl.slice(1));
                        if (file === undefined) return next();

                        res.writeHead(200, {
                            "Content-Type": `image/${compilerOpts.outputFormat}`,
                            "Access-Control-Allow-Origin": "*", // Ensure CORS headers are set for image responses
                        });

                        res.end(file);
                    });
                };
            },
            closeBundle: async () => {
                await watcher.close();
            },
            resolveId,
            load
        }
    ];
}