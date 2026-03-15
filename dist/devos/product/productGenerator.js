"use strict";
// ============================================================
// devos/product/productGenerator.ts
// Orchestrates blueprint → module assembly → product build
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productGenerator = exports.ProductGenerator = void 0;
const path_1 = __importDefault(require("path"));
const blueprintRegistry_1 = require("./blueprintRegistry");
const moduleAssembler_1 = require("./moduleAssembler");
const productManager_1 = require("./productManager");
const eventBus_1 = require("../../core/eventBus");
class ProductGenerator {
    async generate(goal, blueprintId, workspacePath) {
        const start = Date.now();
        // 1. Create product build record
        const build = productManager_1.productManager.create(goal, blueprintId, workspacePath);
        // 2. Load blueprint
        const blueprint = blueprintRegistry_1.blueprintRegistry.get(blueprintId);
        if (!blueprint) {
            productManager_1.productManager.updateStatus(build.id, "failed");
            console.error(`[ProductGenerator] ❌ Blueprint not found: ${blueprintId}`);
            return productManager_1.productManager.get(build.id);
        }
        console.log(`\n[ProductGenerator] 🏗️  Building: ${blueprint.name}`);
        console.log(`[ProductGenerator]    Goal:      "${goal}"`);
        console.log(`[ProductGenerator]    Workspace: ${workspacePath}`);
        console.log(`[ProductGenerator]    Modules:   ${blueprint.steps.map(s => s.module).join(" → ")}\n`);
        productManager_1.productManager.updateStatus(build.id, "building");
        // 3. Assemble each module in step order
        const sortedSteps = [...blueprint.steps].sort((a, b) => a.order - b.order);
        for (const step of sortedSteps) {
            console.log(`[ProductGenerator] ⚙️  Module [${step.order}/${sortedSteps.length}]: ${step.module} — ${step.description}`);
            try {
                const result = await moduleAssembler_1.moduleAssembler.assemble(step.module, blueprint.stack, workspacePath);
                productManager_1.productManager.recordModule(build.id, step.module, result.success);
                eventBus_1.eventBus.emit("product_module_completed", {
                    buildId: build.id,
                    module: step.module,
                    success: result.success,
                    files: result.filesCreated,
                });
                if (!result.success) {
                    console.warn(`[ProductGenerator] ⚠️  Module failed: ${step.module} — ${result.error ?? "unknown"}`);
                }
                else {
                    console.log(`[ProductGenerator] ✅ Module done: ${step.module} (${result.filesCreated.length} files)`);
                }
            }
            catch (err) {
                console.error(`[ProductGenerator] ❌ Module error: ${step.module} — ${err.message}`);
                productManager_1.productManager.recordModule(build.id, step.module, false);
            }
        }
        // 4. Determine final status
        const updated = productManager_1.productManager.get(build.id);
        const allFailed = updated.modulesFailed.length === sortedSteps.length;
        const finalStatus = allFailed ? "failed" : "completed";
        productManager_1.productManager.updateStatus(build.id, finalStatus);
        const duration = Date.now() - start;
        const final = productManager_1.productManager.get(build.id);
        if (final.status === "completed") {
            console.log(`\n[ProductGenerator] ✅ Built: ${blueprint.name} in ${duration}ms`);
            console.log(`[ProductGenerator]    Modules completed: ${final.modulesCompleted.join(", ")}`);
            if (final.modulesFailed.length > 0) {
                console.log(`[ProductGenerator]    Modules failed:    ${final.modulesFailed.join(", ")}`);
            }
        }
        else {
            console.log(`\n[ProductGenerator] ❌ Build failed: ${blueprint.name} in ${duration}ms`);
        }
        // 5. Write a build manifest to the workspace
        this._writeManifest(final, blueprint, workspacePath, duration);
        return final;
    }
    _writeManifest(build, blueprint, workspacePath, durationMs) {
        const manifest = {
            buildId: build.id,
            blueprintId: blueprint.id,
            blueprintName: blueprint.name,
            goal: build.goal,
            status: build.status,
            modulesCompleted: build.modulesCompleted,
            modulesFailed: build.modulesFailed,
            stack: blueprint.stack,
            successCriteria: blueprint.successCriteria,
            builtAt: build.completedAt ?? new Date(),
            durationMs,
        };
        try {
            const manifestPath = path_1.default.join(workspacePath, "BUILD_MANIFEST.json");
            const { fs: _fs } = require("fs");
            require("fs").writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
        }
        catch { /* non-fatal */ }
    }
}
exports.ProductGenerator = ProductGenerator;
exports.productGenerator = new ProductGenerator();
