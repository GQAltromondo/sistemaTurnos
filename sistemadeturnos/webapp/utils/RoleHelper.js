sap.ui.define([
    "transener/sistemadeturnos/utils/AppManagementHelper"
], function(AppManagementHelper) {
    "use strict";
    
    return {
        // Permiso de edición
        ROLES_EDITOR: [
            "ope_programacion_cotdt",
            "ope_programacion_cot",
            "ope_jefe_cot"
        ],
        
        // Verifica si el actual es editor
        isEditor: function() {
            var oUserModel = AppManagementHelper.getModel("UserJsonModel");
            var aUserRoles = oUserModel.getProperty("/roles") || [];
            
            return this.ROLES_EDITOR.some(function(rol) {
                return aUserRoles.indexOf(rol) !== -1;
            });
        },
        
        // O visualizador
        isViewer: function() {
            return !this.isEditor();
        },
        
        // Rol a verificar
        hasRole: function(sRole) {
            var oUserModel = AppManagementHelper.getModel("UserJsonModel");
            var aUserRoles = oUserModel.getProperty("/roles") || [];
            return aUserRoles.indexOf(sRole) !== -1;
        }
    };
});