/**
 * Data tables: standalone embed-table and summarized sum-metrics-table.
 */

function esc() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml
    ? globalThis.ChimeraUI.escapeHtml
    : function (s) {
        return String(s);
      };
}

function escA() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr
    ? globalThis.ChimeraUI.escapeAttr
    : esc();
}

/**
 * @param {{headers: {text: string, className?: string}[], rows: {cells: {html: string, className?: string}[]}[], tableClass?: string, wrapClass?: string}} model
 * @returns {string}
 */
function render(model) {
  model = model || {};
  var headers = Array.isArray(model.headers) ? model.headers : [];
  var rows = Array.isArray(model.rows) ? model.rows : [];
  var tableCls = model.tableClass != null ? String(model.tableClass) : "embed-table";
  var wrapCls = model.wrapClass != null ? String(model.wrapClass) : "embed-table-wrap";
  var h = '<div class="' + escA()(wrapCls) + '"><table class="' + escA()(tableCls) + '"><thead><tr>';
  for (var hi = 0; hi < headers.length; hi++) {
    var hd = headers[hi] || {};
    var thCls = hd.className ? ' class="' + escA()(hd.className) + '"' : "";
    h += "<th" + thCls + ">" + esc(hd.text != null ? hd.text : "") + "</th>";
  }
  h += "</tr></thead><tbody>";
  for (var ri = 0; ri < rows.length; ri++) {
    var row = rows[ri] || {};
    var cells = Array.isArray(row.cells) ? row.cells : [];
    h += "<tr>";
    for (var ci = 0; ci < cells.length; ci++) {
      var cell = cells[ci] || {};
      var tdCls = cell.className ? ' class="' + escA()(cell.className) + '"' : "";
      h += "<td" + tdCls + ">" + (cell.html != null ? cell.html : "") + "</td>";
    }
    h += "</tr>";
  }
  h += "</tbody></table></div>";
  return h;
}

/**
 * @param {string} theadRowHtml full <tr>…</tr> for header
 * @param {string} tbodyHtml
 * @param {{wrapClass?: string, tableClass?: string}=} opts
 * @returns {string}
 */
function renderSumMetrics(theadRowHtml, tbodyHtml, opts) {
  opts = opts || {};
  var wrapCls = opts.wrapClass != null ? String(opts.wrapClass) : "sum-metrics-table-wrap";
  var tableCls = opts.tableClass != null ? String(opts.tableClass) : "sum-metrics-table";
  return (
    '<div class="' +
    escA()(wrapCls) +
    '"><table class="' +
    escA()(tableCls) +
    '"><thead>' +
    theadRowHtml +
    "</thead><tbody>" +
    (tbodyHtml != null ? tbodyHtml : "") +
    "</tbody></table></div>"
  );
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.DataTable = { render: render, renderSumMetrics: renderSumMetrics };
