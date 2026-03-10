sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/BusyDialog",
    "sap/m/Dialog",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/Button",
    "transener/sistemadeturnos/utils/ModelHelper"
], function (
    JSONModel,
    BusyDialog,
    Dialog,
    VBox,
    Label,
    Select,
    Item,
    Button,
    ModelHelper
) {
    "use strict";

    return {
        
        loadSociety: async function (oController, oModelOperaciones, fnOnEmpresaLoaded) {
            var that = this;
            var oBusyDialog = this.crearDialogoBusy();
            this.abrirDialogoBusy(oBusyDialog);

            try {
                var sEmpresa = null;
                var bIsLocal = window.location.hostname.includes("applicationstudio.cloud.sap");

                // Si es local o no hay modelo, mostrar diálogo directamente
                if (bIsLocal || !oModelOperaciones) {
                    sEmpresa = await this._showSocietyDialog(oController);
                } else {
                    // Intentar cargar desde backend
                    try {
                        var oData = await new Promise(function (resolve, reject) {
                            oModelOperaciones.read("/EmpresaUsuarioSet", {
                                success: resolve,
                                error: reject
                            });
                        });

                        sEmpresa = oData.results[0].Empresa;
                        
                        // Si empresa es 999, mostrar diálogo de selección
                        if (sEmpresa == 999) {
                            sEmpresa = await this._showSocietyDialog(oController);
                        } else {
                            // Guardar en modelo y sessionStorage
                            this._setEmpresaInModel(oController, sEmpresa);
                        }
                    } catch (oError) {
                        // Si falla la carga, mostrar diálogo
                        console.warn("No se pudo cargar empresa desde backend, mostrando diálogo:", oError);
                        sEmpresa = await this._showSocietyDialog(oController,);
                    }
                }

                this.cerrarDialogoBusy(oBusyDialog);
                
                // Ejecutar callback si se proporcionó
                if (fnOnEmpresaLoaded && sEmpresa) {
                    fnOnEmpresaLoaded(sEmpresa);
                }
                
                return Promise.resolve(sEmpresa);
                
            } catch (err) {
                this.cerrarDialogoBusy(oBusyDialog);
                console.error("Error al cargar empresa:", err);
                throw err;
            }
        },

      
        _showSocietyDialog: function (oController) {
            var that = this;
            return new Promise(function (resolve) {
                var aDefaultEmpresas =  [
                    { Code: "", Name: "Elija Uno" },
                    { Code: "100", Name: "TRANSENER S.A." },
                    { Code: "300", Name: "TRANSBA S.A." }
                ];

                var oSelectId = oController.getView().getId() + "--societySelect";
                var oDialogSociety = new Dialog({
                    type: sap.m.DialogType.Message,
                    title: "Selección de Empresa",
                    escapeHandler: function (oPromise) {
                        oPromise.reject();
                    },
                    content: [
                        new VBox({
                            items: [
                                new Label({ text: "Debe seleccionar la empresa:" }),
                                new Select({
                                    id: oSelectId,
                                    selectedKey: "{Society>/Code}",
                                    change: function(oEvent) {
                                        var oSelect = oEvent.getSource();
                                        var oModel = oSelect.getModel("Society");
                                        var sCode = oModel.getProperty("/Code");
                                        oSelect.setValueState(sCode ? "None" : "Error");
                                    },
                                    items: {
                                        path: "Society>/Empresas",
                                        template: new Item({
                                            key: "{Society>Code}",
                                            text: "{Society>Name}"
                                        })
                                    }
                                })
                            ]
                        })
                    ],
                    buttons: [
                        new Button({
                            icon: "sap-icon://save",
                            type: sap.m.ButtonType.Emphasized,
                            text: "Guardar",
                            press: function() {
                                var oModel = oDialogSociety.getModel("Society");
                                var sEmpresa = oModel.getProperty("/Code");
                                
                                if (sEmpresa && sEmpresa !== "") {
                                    that._setEmpresaInModel(oController, sEmpresa);
                                    oDialogSociety.close();
                                    resolve(sEmpresa);
                                } else {
                                    var oSelect = sap.ui.getCore().byId(oSelectId);
                                    if (oSelect) oSelect.setValueState("Error");
                                }
                            }
                        })
                    ]
                });

                var oModel = new JSONModel({
                    Code: "",
                    Empresas: aDefaultEmpresas
                });

                oDialogSociety.setModel(oModel, "Society");
                oDialogSociety.open();
            });
        },

        _setEmpresaInModel: function (oController, sEmpresa) {
            var oView = oController.getView();
            var oEmpresaModel = ModelHelper.getModel("Empresa", oView);
            oEmpresaModel.setProperty("/selectedSociety", sEmpresa);
            
            if (oController) {
                oController.society = sEmpresa;
            }
            
            sessionStorage.setItem("empresa", sEmpresa);
        },

    
        getCurrentSociety: function (oView, sDefault) {
            sDefault = sDefault || "100";
            
            var oEmpresaModel = oView ? oView.getModel("Empresa") : null;
            if (oEmpresaModel) {
                var sEmpresa = oEmpresaModel.getProperty("/selectedSociety");
                if (sEmpresa) return sEmpresa;
            }
            
            var sSessionEmpresa = sessionStorage.getItem("empresa");
            if (sSessionEmpresa) return sSessionEmpresa;
            
            return sDefault;
        },

       
        crearDialogoBusy: function (sTitle, sText) {
            return new BusyDialog({
                title: sTitle || "Actualizando datos...",
                text: sText || "Espere un momento por favor",
                showCancelButton: false
            });
        },

      
        abrirDialogoBusy: function (oDialog) {
            if (oDialog) oDialog.open();
        },

       
        cerrarDialogoBusy: function (oDialog) {
            if (oDialog) oDialog.close();
        }
    };
});
