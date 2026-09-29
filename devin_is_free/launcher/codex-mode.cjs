const route = require('./codex-state.cjs');
const model = require('./codex-model.cjs');

function applyRoute() {
  const routeResult = route.applyRoute();
  const modelResult = model.activate();
  return { ...routeResult, model: modelResult.model, devinActive: true };
}

function restoreRoute() {
  const modelResult = model.restore();
  const routeResult = route.restoreRoute();
  return { ...routeResult, restoredModel: modelResult.model ?? null };
}

function status() {
  const routeStatus = route.status();
  const modelStatus = model.status();
  return {
    ...routeStatus,
    model: modelStatus.model,
    devinModel: modelStatus.target,
    devinActive: Boolean(routeStatus.applied && modelStatus.active),
  };
}

module.exports = {
  ROUTE_URL: route.ROUTE_URL,
  statePath: route.statePath,
  applyRoute,
  restoreRoute,
  status,
};
