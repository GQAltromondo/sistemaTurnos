sap.ui.define([
    //helpers
    "transener/sistemadeturnos/utils/ModelHelper"
], function (ModelHelper) {
    "use strict";

    return {
        _entitySet: "/TipoIntervencionSet",


        getPromise: function (oView) {
            return new Promise((resolve, reject) => {
                oView.getModel().read(this._entitySet, {
                    success: function (data) {
                        resolve(data);

                        ModelHelper.getModel("TiposIntervencion", oView).setData({
                            TiposIntervencion: data.results
                        })

                    },
                    error: function (error) {
                        reject(error);
                    }
                });
            });
        }

    };
});