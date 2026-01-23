sap.ui.define([], function() {
    "use strict";
    
    return {

        getModel: function(sModelName) {
            return sap.ui.getCore().getModel(sModelName);
        },
        
        setModel: function(oModel, sModelName) {
            sap.ui.getCore().setModel(oModel, sModelName);
        }
    };
});