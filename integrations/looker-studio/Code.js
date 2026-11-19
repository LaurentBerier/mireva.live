// Set API_BASE to the agency frontend's HTTPS origin before deploying this connector.
var API_BASE = 'https://YOUR-AGENCY-DOMAIN';
var cc = DataStudioApp.createCommunityConnector();
function getAuthType() { return cc.newAuthTypeResponse().setAuthType(cc.AuthType.KEY).build(); }
function resetAuth() { PropertiesService.getUserProperties().deleteProperty('agency.key'); }
function requestMetrics(key, from, to) {
  var query = from ? '?from=' + encodeURIComponent(from + 'T00:00:00.000Z') + '&to=' + encodeURIComponent(to + 'T23:59:59.999Z') : '';
  return UrlFetchApp.fetch(API_BASE + '/api/backend/agency-public/metrics' + query, {
    headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true, followRedirects: false,
  });
}
function setCredentials(request) {
  var key = request.key;
  if (requestMetrics(key).getResponseCode() !== 200) return { errorCode: 'INVALID_CREDENTIALS' };
  PropertiesService.getUserProperties().setProperty('agency.key', key);
  return { errorCode: 'NONE' };
}
function isAuthValid() {
  var key = PropertiesService.getUserProperties().getProperty('agency.key');
  return Boolean(key && requestMetrics(key).getResponseCode() === 200);
}
function getConfig() {
  var config = cc.getConfig();
  config.newInfo().setId('help').setText('Reads the brand associated with your revocable analytics key. Native provider metrics retain their original definitions.');
  config.setDateRangeRequired(true);
  return config.build();
}
function getFields() {
  var fields = cc.getFields();
  fields.newDimension().setId('date').setName('Metric date').setType(cc.FieldType.YEAR_MONTH_DAY);
  ['provider', 'channel', 'post', 'metric', 'definition', 'collectedAt'].forEach(function (id) {
    fields.newDimension().setId(id).setName(id).setType(cc.FieldType.TEXT);
  });
  // Different metric definitions must be filtered before meaningful aggregation.
  fields.newMetric().setId('value').setName('Native metric value').setType(cc.FieldType.NUMBER).setAggregation(cc.AggregationType.SUM);
  return fields;
}
function getSchema() { return { schema: getFields().build() }; }
function getData(request) {
  var key = PropertiesService.getUserProperties().getProperty('agency.key');
  var response = requestMetrics(key, request.dateRange.startDate, request.dateRange.endDate);
  if (response.getResponseCode() !== 200) cc.newUserError().setText('Metrics unavailable. Check the analytics key and choose a range of at most 366 days.').throwException();
  var fields = getFields().forIds(request.fields.map(function (field) { return field.name; }));
  var data = JSON.parse(response.getContentText());
  return { schema: fields.build(), rows: data.rows.map(function (row) {
    return { values: fields.asArray().map(function (field) { return row[field.getId()]; }) };
  }) };
}
function isAdminUser() { return false; }
