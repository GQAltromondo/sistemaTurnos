sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    return {
        getModel: function (sModelName, oView) {
            let oModel = oView.getModel(sModelName);

            if (!oModel) {
                oModel = new JSONModel();
                oModel.setSizeLimit(999999);
                oView.setModel(oModel, sModelName);
            }

            return oModel;
        }

    };
});
