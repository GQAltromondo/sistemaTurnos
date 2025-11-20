sap.ui.define([

], function () {
    "use strict";

    return {

        _destination: "/destinations/SAP_Gateway",
        _servicePath: "/sap/opu/odata/sap/Z_SCP_HABILITACIONES_SRV",

        //session language
        _defaultSessionLanguage: "ES",
        _otherSessionLanguages: [
            "EN", "PT"
        ],

        _services: {
            TransenerOperaciones: "/destinations/SAP_Gateway/sap/opu/odata/sap/Z_SCP_OPERACIONES_SRV",
            WorkOrderMaster: "/destinations/SAP_Gateway/sap/opu/odata/sap/Z_SCP_WO_MASTER_SRV",
            SelectModel: "/destinations/SAP_Gateway/sap/opu/odata/sap/Z_SCP_OPERACIONES_SRV",
            LibroGuardias: "/destinations/SAP_Gateway/sap/opu/odata/sap/Z_SCP_LIBRO_GUARDIAS_SRV"
        },

        _models: {},

        _getSessionLanguage: function () {
            //gets browser language
            var browserLanguage = sap.ui.getCore().getConfiguration().getSAPLogonLanguage();
            //finds language
            var results = jQuery.grep(this._otherSessionLanguages, function (otherLanguage) {
                return browserLanguage === otherLanguage;
            });
            //returns sap session language
            return (results.length > 0) ? browserLanguage : this._defaultSessionLanguage;
        },

        getModel: function (name) {
            if (!this._models[name]) {
           
                var baseurl = sap.ui.getCore().getModel("appCurrentInfo")

                var url = baseurl.appUrl + this._services[name];

                this._models[name] = new sap.ui.model.odata.v2.ODataModel(url, {
                    json: true,
                    useBatch: false,
                    headers: {
                        "DataServiceVersion": "2.0",
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache"
                    },
                    metadataUrlParams: {
                        "sap-language": "ES"
                    },
                    serviceUrlParams: {
                        "sap-language": "ES"
                    },
                    defaultUpdateMethod: "PUT"
                });
            }
            this._models[name].setSizeLimit(99999);
          
            return this._models[name];
        }
    };
});
