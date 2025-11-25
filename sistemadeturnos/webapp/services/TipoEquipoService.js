sap.ui.define([
    "transener/sistemadeturnos/utils/ModelHelper"
], function (ModelHelper) {
    "use strict";

    return {
        _entitySet: "/NSTipoEquipoSet",

        loadTipoEquipo: function (empresa, oView) {
            var aFilter = [new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, empresa)];
            this.getTiposPromise(aFilter, oView).then($.proxy(this.successGetTipos(oView), this)).catch($.proxy(this.errorGetTipos, this));
        },

        getTiposPromise: function (aFilter, oView) {
            var that = this;
            return new Promise((resolve, reject) => {
                let entity = that._entitySet;
                oView.getModel().read(entity, {
                    filters: aFilter,
                    success: function (data) {
                        // data.model = model;
                        resolve(data);
                    },
                    error: function (error) {
                        reject(error);
                    }
                });
            });
        },

        successGetTipos: function (data, oView) {
            var aData = data.results;
            var model = ModelHelper.getModel("TipoEquipoJsonModel", oView);
            model.setData({
                TipoEquipo: aData
            });
        },

        errorGetTipos: function (error) {
            //console.log("Error al cargar Equipos");
        }

    };
});