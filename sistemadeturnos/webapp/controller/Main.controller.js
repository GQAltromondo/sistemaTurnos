sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/services/LicenseService",
    "transener/sistemadeturnos/services/TurnosService",


], function (Controller, MessageToast, MessageBox, Filter, FilterOperator, Fragment,
    //utils
    ModelHelper, FormatHelper,
    //services
    LicenseService, TurnosService
) {
    "use strict";
    var oDialog = null
    return Controller.extend("transener.sistemadeturnos.controller.Main", {
        formatter: FormatHelper,

        onInit: function () {
            const oView = this.getView()
            this._pBusyDialog = null; // promesa del fragment
            this.getVersion();
            this.getBaseURL();
            ModelHelper.getModel("LicencesJsonModel", oView)
            this.cargarModelos()
        },
        cargarModelos: function () {
            const oView = this.getView()
            ModelHelper.getModel("HorarioLicenciaJsonModel", oView);
            ModelHelper.getModel("consolasModel", oView)
            ModelHelper.getModel("LocalFilterJsonModel", oView);
            ModelHelper.getModel("ColorModel", oView).setProperty("/Color", "white");
            ModelHelper.getModel("consolasModel", oView).loadData("model/ConsolasModel.json", "", false);
            ModelHelper.getModel("enabledModel", oView).loadData("model/EnabledModel.json", "", false);
            ModelHelper.getModel("tabsControl", oView).setData({ activeTab: "LIC" });
        },
        onTabSelect: function (oEvent) {
            const key = oEvent.getParameter("key");
            this.getView().getModel("tabsControl").setProperty("/activeTab", key);
        },
        getVersion: function () {
            const oComponent = this.getOwnerComponent();
            let jsonModel = sap.ui.getCore().getModel("appVersion");

            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);

                const sVersion = oComponent.getManifestEntry("/sap.app/applicationVersion/version");

                jsonModel.setData({ version: sVersion });

                sap.ui.getCore().setModel(jsonModel, "appVersion");
                this.getView().setModel(jsonModel, "appVersion");
            } else if (!this.getView().getModel("appVersion")) {
                this.getView().setModel(jsonModel, "appVersion");
            }
        },

        getBaseURL: function () {
            const appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            const appModulePath = jQuery.sap.getModulePath(appPath);

            let jsonModel = sap.ui.getCore().getModel("appCurrentInfo");
            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);
                jsonModel.setData({ appUrl: appModulePath });
                sap.ui.getCore().setModel(jsonModel, "appCurrentInfo");
            }

            return appModulePath;
        },
        onSelectTurno: function (oEvent) {
            // Mostrar Busy global
            this.showGlobalBusy("Buscando turnos creados…");
            const oView = this.getView()
            const oDataService = this.getView().getModel();

            ModelHelper.getModel("enabledModel", oView).setData({
                btnCrear: true,
                btnGuardar: true,
                btnEnviar: true
            });

            const oDatePicker = oEvent.getSource();
            const sSelectedDate = oDatePicker.getDateValue();
            const sFormattedDate = FormatHelper.formatDate(sSelectedDate);

            ModelHelper.getModel("LicencesTurnoJsonModel", oView)
                .setProperty("/FechaTurno", sFormattedDate);

            const aFilters = [];
            aFilters.push(new Filter("Dateturno", FilterOperator.EQ, this.byId("date").getDateValue()));
            aFilters.push(new Filter("Empresa", FilterOperator.EQ, "100"));

            const sEntity = "/TurnosLicenciasSet";

            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {

                    this.successSelectTurno(oData)
                        .catch((err) => {
                            console.error("Error en successSelectTurno:", err);
                        })
                        .finally(() => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    console.error(oError);

                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    this.onCountItems([]);
                    this.hideGlobalBusy();
                }
            });
        },
        onSearch: function () {
            var dateTurno = this.byId("date");
            var oTable = this.byId("turnosTable");

            var oDateValue = dateTurno.getDateValue();

            if (!oDateValue) {
                sap.m.MessageToast.show("Seleccione una fecha");
                return;
            }


            const FechaTurno = oDateValue;

            var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
            oLicencesModel.setData([]);
            oTable.setBusy(true);


            TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: false })
                .then((data) => {
                    oLicencesModel.setData(data);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                    this.onCountItems(data);
                })
                .catch((error) => {
                    console.error("Error en la búsqueda:", error);
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                });

            this.closeDialog();
        },
        successSelectTurno: function (data) {
            const oView = this.getView();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const oDataModel = this.getView().getModel();

            const aResults = Array.isArray(data?.results) ? data.results : [];

            if (!aResults.length) {
                oLicencesModel.setData([]);
                this.onCountItems([]);
                return Promise.resolve();   // <- para permitir .then/.catch
            }

            const aPromises = aResults.map((licencia) => {
                return LicenseService.FIND(licencia, oDataModel)
                    .then(result => result)
                    .catch(err => {
                        console.error("Error en FIND para licencia", licencia, err);
                        return null;
                    });
            });

            // 🔥 AGREGAR RETURN AQUÍ
            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        oLicencesModel.setData([]);
                        this.onCountItems([]);
                        return;
                    }

                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );

                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    oLicencesModel.setData(arrayOrdenado);
                    this.onCountItems(arrayOrdenado);
                })
                .catch((error) => {
                    console.error("Error inesperado en Promise.all:", error);
                    oLicencesModel.setData([]);
                    this.onCountItems([]);
                });
        },



        // successSelectTurno: async function (data) {
        //     const oView = this.getView()
        //     const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
        //     const oDataModel = this.getView().getModel();

        //     try {
        //         const aResults = Array.isArray(data?.results) ? data.results : [];

        //         if (!aResults.length) {
        //             oLicencesModel.setData([]);
        //             this.onCountItems([]);
        //             return;
        //         }

        //         // Buscar una licencia por vez (sin Promise.all)
        //         const results = [];
        //         for (const licencia of aResults) {
        //             try {
        //                 const licData = await LicenseService.FIND(licencia, oDataModel);
        //                 results.push(licData);
        //             } catch (err) {
        //                 // Si querés seguir aunque falle una licencia:
        //                 console.error("Error en FIND para licencia", licencia, err);
        //                 // Si en vez de seguir querés cortar, podés hacer: throw err;
        //             }
        //         }

        //         if (!results.length) {
        //             oLicencesModel.setData([]);
        //             this.onCountItems([]);
        //             return;
        //         }

        //         // Procesar lógica de negocio
        //         const arrayOrdenado = TurnosService.encontrarGrupo(
        //             TurnosService.ordenarPorEqunr(results), this.getView()
        //         );

        //         TurnosService.assignShiftsToLicences(arrayOrdenado);

        //         console.log(oLicencesModel)

        //         oLicencesModel.setData(arrayOrdenado);


        //         this.onCountItems(arrayOrdenado);

        //     } catch (error) {
        //         console.error("Error en successSelectTurno:", error);
        //         oLicencesModel.setData([]);
        //         this.onCountItems([]);

        //     }
        // },


        onCountItems: function (data) {
            let countLTWithManouvers = 0;
            let countLTWithoutManouvers = 0;
            let countTCT = 0;

            data.forEach(item => {
                if (item.Jobcond === "01" || item.Jobcond === "02" || item.Jobcond === "04") {
                    countLTWithManouvers++;
                } else if (item.Jobcond === "05") {
                    countLTWithoutManouvers++;
                } else if (item.Jobcond === "03" || item.Jobcond === "06") {
                    countTCT++;
                }
            });

            const totalCount = countLTWithManouvers + countLTWithoutManouvers + countTCT;

            // Crear un modelo con los resultados
            const counts = {
                LTWithManouvers: countLTWithManouvers,
                LTWithoutManouvers: countLTWithoutManouvers,
                TCT: countTCT,
                Total: totalCount
            };

            // Asignar el modelo al View
            const oModel = new sap.ui.model.json.JSONModel(counts);
            this.getView().setModel(oModel, "countsModel");
        },
        onChangeHour: function (oEvent) {

            var oSource = oEvent.getSource();
            var sPath = oSource.getBindingContext("LicencesJsonModel").getPath();
            var iLicenseIndex = parseInt(sPath.split("/")[1], 10);


            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getProperty("/");


            var sNewTime = oEvent.getParameter("value");


            var oSelectedLicence = aLicences[iLicenseIndex];


            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, sNewTime);


            this._sortLicences(aLicences);


            oModel.setProperty("/", aLicences);
            oModel.refresh(true);
        },
        _updateSameGroupAndConsoleShifts: function (aLicences, oSelectedLicence, sNewTime) {
            // Recorre las licencias y actualiza el horario solo de aquellas que comparten el mismo Grupo y Consola
            aLicences.forEach(function (oLicence) {
                if (oLicence.Consola === oSelectedLicence.Consola && oLicence.Grupo === oSelectedLicence.Grupo) {
                    oLicence.TurnoAsignado = sNewTime;
                }
            });
        },
        _sortLicences: function (aLicences) {

            aLicences.sort((a, b) => {
                const aHasTurno = !!a.TurnoAsignado;
                const bHasTurno = !!b.TurnoAsignado;


                if (!aHasTurno && !bHasTurno) return 0;


                if (!aHasTurno) return 1;


                if (!bHasTurno) return -1;


                return this._convertShiftToMinutes(a.TurnoAsignado) -
                    this._convertShiftToMinutes(b.TurnoAsignado);
            });


            aLicences.sort((a, b) => {
                if (a.Consola !== b.Consola) {
                    return a.Consola.localeCompare(b.Consola);
                }
                return 0;
            });
        },

        _convertShiftToMinutes: function (shift) {
            const [hours, minutes] = shift.split(":").map(Number);
            return hours * 60 + minutes;
        },
        onDeletePress: function () {
            const oTable = this.getView().byId("turnosTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                MessageToast.show("Por favor, seleccione al menos una fila para eliminar.");
                return;
            }

            const oModel = this.getView().getModel("LicencesJsonModel");
            let aLicenses = oModel.getProperty("/");

            if (!Array.isArray(aLicenses) || aLicenses.length === 0) {
                MessageToast.show("No hay datos para eliminar.");
                return;
            }

            let aDataToDelete = [];

            // Ordenar índices de mayor a menor para evitar errores al eliminar
            aSelectedIndices.sort((a, b) => b - a);

            // Extraer datos de las filas seleccionadas
            aSelectedIndices.forEach(index => {
                if (index >= 0 && index < aLicenses.length) {
                    let oRowData = aLicenses[index];

                    aDataToDelete.push({
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo || "L",
                        Anio: oRowData.Anio,
                        Dateturno: new Date(oRowData.Fecha),
                    });

                    aLicenses.splice(index, 1); // Eliminar del modelo local
                }
            });

            // Actualizar modelo en la vista
            oModel.setProperty("/", aLicenses);
            oModel.refresh(true);
            oTable.clearSelection();

            MessageToast.show("Se ha eliminado la(s) licencia(s) seleccionada(s).");

            //TODO BackEnd para eliminar en base hoy solo elimina local tabla

            this.deleteTurno(aDataToDelete);
        },
        onDetachLicense: function () {
            var oTable = this.byId("turnosTable");

            // Check if a row is selected
            var iSelectedIndex = oTable.getSelectedIndex();
            if (iSelectedIndex === -1) {
                MessageToast.show("Por favor, seleccione una fila para desacoplar.");
                return;
            }

            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getData();

            // Check if the model data is available and the index is valid
            if (!oModel || !aLicences || iSelectedIndex < 0 || iSelectedIndex >= aLicences.length) {
                MessageToast.show("Datos no válidos.");
                return;
            }

            // Detach the selected license
            var oDetachedLicense = aLicences.splice(iSelectedIndex, 1)[0];
            var groupConsola = oDetachedLicense.Consola;  // Get the Consola value (group identifier)

            // Find the last item in the same group
            var groupLastIndex = -1;
            for (var i = aLicences.length - 1; i >= 0; i--) {
                if (aLicences[i].Consola === groupConsola) {
                    groupLastIndex = i;
                    break;
                }
            }

            if (groupLastIndex === -1) {
                MessageToast.show("No se encontró el grupo de la licencia.");
                return;
            }

            // Get the last license in the group to calculate the new time
            var oLastLicenseInGroup = aLicences[groupLastIndex];
            var currentTime = this._convertShiftToMinutes(oLastLicenseInGroup.TurnoAsignado);
            var shiftDuration = oDetachedLicense.Jobcond === "04" ? 30 : 15;

            currentTime += shiftDuration;
            oDetachedLicense.TurnoAsignado = this._formatTime(currentTime);

            // Assign a unique group for the detached license
            oDetachedLicense.Grupo = "_Desacoplado_" + oDetachedLicense.Id;

            // Insert the detached license after the last element of the group
            aLicences.splice(groupLastIndex + 1, 0, oDetachedLicense);

            // Update the model
            oModel.setProperty("/", aLicences);
            oModel.refresh(true);

            // Clear selection in the table
            oTable.clearSelection();

            // Notify the user
            MessageToast.show("Licencia desacoplada, asignada después del último elemento del grupo con nuevo turno y grupo individual.");
        },
        _formatTime: function (iMinutes) {
            // Convertir los minutos de nuevo a formato HH:mm
            var iHours = Math.floor(iMinutes / 60);
            var iRemainderMinutes = iMinutes % 60;

            // Asegurarse de que siempre tenga 2 dígitos
            return (iHours < 10 ? "0" : "") + iHours + ":" + (iRemainderMinutes < 10 ? "0" : "") + iRemainderMinutes;
        },
        onAddLicense: function () {
            this.onSelectLicense()
                .then(function () {
                    this.openDialog("transener.sistemadeturnos.fragments.addLicenses");
                }.bind(this));
        },
        onSelectLicense: function () {
            const oSearchModel = ModelHelper.getModel("SearchLicense", this.getView());
            this.getView().setModel(oSearchModel, "SearchLicense");

            var dateTurno = this.byId('date');

            const FechaTurno = dateTurno.getDateValue()


            return TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: true })
                .then((resultadoFinal) => {

                    // 1) Tomamos las licencias ya agregadas
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
                    const aLicenciasExistentes = oLicencesModel?.getData() || [];

                    // 2) Armamos un Set con los Id ya existentes
                    const idsExistentes = new Set(
                        aLicenciasExistentes.map((l) => l.Id)   // 🔁 CAMBIAR "Id" por tu campo real (p.ej. "IdLicencia")
                    );

                    // 3) Nos quedamos SOLO con las nuevas
                    const aNuevas = resultadoFinal.filter(item =>
                        !idsExistentes.has(item.Id)             // 🔁 mismo campo que arriba
                    );

                    // 4) Guardamos SOLO las nuevas en el modelo de búsqueda
                    oSearchModel.setData(aNuevas);
                    oSearchModel.refresh();

                    this.onCountItems(aNuevas);
                })
                .catch((error) => {
                    console.error("Error en la búsqueda:", error);
                    oSearchModel.setData([]);
                    oSearchModel.refresh();
                });
        },
        showGlobalBusy: function (sText) {
            var oView = this.getView();

            if (!this._pBusyDialog) {
                this._pBusyDialog = Fragment.load({
                    id: oView.getId(), // 👈 MUY IMPORTANTE
                    name: "transener.sistemadeturnos.fragments.BusyDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pBusyDialog.then(function (oDialog) {
                // Ahora this.byId sí ve el Text del fragment
                var oLabel = this.byId("busyLabel");
                if (oLabel) {
                    oLabel.setText(sText || "");
                }
                oDialog.open();
            }.bind(this));
        },

        hideGlobalBusy: function () {
            if (this._pBusyDialog) {
                this._pBusyDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },
        openDialog: function (fragment) {
            var oView = this.getView();

            // Si ya había un diálogo, lo destruyo
            if (oDialog) {
                oDialog.destroy();
                oDialog = null;
            }

            Fragment.load({
                id: oView.getId(),       // 👈 importante para heredar los ids
                name: fragment,
                controller: this,
            }).then(function (oFragment) {
                oDialog = oFragment;

                // Lo cuelgo de la vista
                oView.addDependent(oDialog);

                // 👇 Traigo el modelo de la vista y se lo paso al diálogo
                var oSearchLicenseModel = oView.getModel("SearchLicense");
                if (oSearchLicenseModel) {
                    oDialog.setModel(oSearchLicenseModel, "SearchLicense");
                }

                oDialog.open();
            }.bind(this));
        },


        closeDialog: function () {
            if (oDialog) {
                oDialog.close();
            }
        },
        onPressAdd: function () {
            var oTable = this.byId("idLicensesTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Debe seleccionar al menos un elemento.");
                return;
            }

            // Datos seleccionados desde SearchLicense
            var aSelectedData = aSelectedItems.map(oItem =>
                oItem.getBindingContext("SearchLicense").getObject()
            );

            // Modelo actual que ya contiene turnos asignados
            var oLicencesModel = this.getView().getModel("LicencesJsonModel");
            var aCurrentData = oLicencesModel.getProperty("/") || [];

            // Filtrar los que ya existen (según tu regla de Id)
            var aNewData = aSelectedData.filter(item =>
                !aCurrentData.some(existing => existing.Id === item.Id)
            );

            if (aNewData.length === 0) {
                MessageBox.information("Los elementos seleccionados ya están en la lista.");
                return;
            }


            TurnosService.appendLicencesToModel(aNewData, this.getView());

            MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");

            console.log("Datos agregados:", aNewData);
        },

        onOpenComboPopover: function (oEvent) {

            this._oRowContext = oEvent.getSource().getBindingContext("LicencesJsonModel");


            var oModel = this.getView().getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();


            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];


            if (!this._oComboPopover) {

                this._oComboPopover = sap.ui.xmlfragment("transener.sistemadeturnos.fragments.ComboPopover", this);
                this.getView().addDependent(this._oComboPopover);
            }


            this._initializeCheckBoxes(aAccionesEntregas);


            this._oComboPopover.openBy(oEvent.getSource());
        },
        _initializeCheckBoxes: function (aAccionesEntregas) {

            var oFragment = this._oComboPopover;


            var aCheckBoxes = [
                { id: "checkboxSOL_COC", key: "SOL COC" },
                { id: "checkboxSOL_TEC", key: "SOL TEC" },
                { id: "checkboxAUT_COC", key: "AUT COC" }

            ];

            aCheckBoxes.forEach(function (oCheckBox) {

                var oCheckBoxControl = sap.ui.core.Fragment.byId("transener.sistemadeturnos.fragments.ComboPopover", oCheckBox.id);


                if (oCheckBoxControl) {
                    oCheckBoxControl.setSelected(false);
                }
            });


            aAccionesEntregas.forEach(function (oEntry) {
                var oCheckBoxControl = aCheckBoxes.find(function (oCheckBox) {
                    return oCheckBox.key === oEntry.nombre;
                });

                if (oCheckBoxControl) {
                    var oCheckBoxUIControl = sap.ui.core.Fragment.byId("transener.sistemadeturnos.fragments.ComboPopover", oCheckBoxControl.id);
                    if (oCheckBoxUIControl) {
                        oCheckBoxUIControl.setSelected(true);
                    }
                }
            });
        }, onClosePopover: function () {
            this._oComboPopover.close();
        }, formatCheckBoxSelected: function (aAccionesEntregas, sCheckBoxKey) {

            return aAccionesEntregas && aAccionesEntregas.some(function (oEntry) {
                return oEntry.nombre === sCheckBoxKey;
            });
        }, onCheckBoxSelect: function (oEvent) {

            var oCheckBox = oEvent.getSource();
            var sKey = oCheckBox.getText();


            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = this.getView().getModel("LicencesJsonModel");


            var sPath = this._oRowContext.getPath();


            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];

            if (oCheckBox.getSelected()) {

                aAccionesEntregas.push({
                    nombre: sKey,
                    descripcion: "Descripción para " + sKey
                });
            } else {

                aAccionesEntregas = aAccionesEntregas.filter(function (oEntry) {
                    return oEntry.nombre !== sKey;
                });
            }

            // Actualizar el modelo con el nuevo array
            oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
        }, onSaveTurnoPress: function () {

            //  const FechaTurno = ModelHelper.getModel("LicencesTurnoJsonModel",this.getView()).getProperty("/FechaTurno")
            const Fecha = this.getView().byId('date').getDateValue()
            const oTable = this.getView().byId('turnosTable');
            const aRows = oTable.getRows(); // Obtén las filas visibles de la tabla
            const aData = []; // Array para almacenar los datos de cada fila

            aRows.forEach(function (oRow) {
                // Accede al contexto de cada fila (a través del modelo asociado)
                const oContext = oRow.getBindingContext("LicencesJsonModel");
                if (oContext) {
                    // Obtén los datos de la fila a través del contexto
                    const oRowData = oContext.getObject();

                    const row = {
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo,
                        Anio: oRowData.Anio,
                        Fecha: Fecha,
                        Turno: oRowData.TurnoAsignado

                    }

                    aData.push(row);

                }
            });

            console.log("Datos de cada fila:", aData);

            this.createTurno(aData)
        },
        createTurno: function (licencias) {
            var entity = "/TurnosLicenciasSet";

            const oDataService = this.getView().getModel()

            licencias.forEach(function (licencia) {

                var license = {
                    "Id": licencia.Id,
                    "Empresa": licencia.Empresa,
                    "Tipo": licencia.Tipo || "L",
                    "Anio": licencia.Anio,
                    "Dateturno": new Date(licencia.Fecha),
                    "Turno": licencia.Turno
                };

                oDataService.create(entity, license);
            });
        }
        , openAdvancedFilters: function () {
            var oFiltersModel = AppManagementHelper.getModel("FiltersJsonModel");
            var oHardCodeModel = AppManagementHelper.getModel("HardCodeModel");
            var PersonalHabilitadoModel = AppManagementHelper.getModel("PersonalHabilitadoModel");
            var oRepModel = AppManagementHelper.getModel("RepositionTimes");
            var oSelectModel = AppManagementHelper.getModel("SelectModel");
            var society = this.society;

            // Carga los servicios necesarios
            TipoEquipoService.loadTipoEquipo(society);
            InterventionTypesService.getPromise();

            // Verifica si ya existe el diálogo
            if (!this.advancedFilters) {
                // Carga el fragmento y lo inserta en el diálogo
                var oView = this.getView();
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.advancedFilters",
                    controller: this
                }).then(function (oDialogContent) {
                    var oDialog = new sap.m.Dialog({
                        title: "Filtros Avanzados",
                        contentWidth: "60%",
                        modal: true,
                        content: oDialogContent,
                        buttons: [
                            new sap.m.Button({
                                text: "Cancelar",
                                icon: "sap-icon://decline",
                                press: this.closeAdvancedFilters.bind(this)
                            }).addStyleClass("buttonInverted floatLeft"),
                            new sap.m.Button({
                                text: "Limpiar",
                                icon: "sap-icon://document",
                                press: this.clearAdvancedFilters.bind(this)
                            }).addStyleClass("buttonInverted floatLeft"),
                            new sap.m.Button({
                                text: "Aplicar",
                                icon: "sap-icon://search",
                                press: this.makeFilters.bind(this)
                            }).addStyleClass("buttonInverted floatRight")
                        ]
                    }).addStyleClass("customDialog");

                    // Asignar los modelos al diálogo
                    oDialog.setModel(AppManagementHelper.getModel("WorkPlacesJsonModel"), "WorkPlacesJsonModel");
                    oDialog.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                    oDialog.setModel(AppManagementHelper.getModel("TiposIntervencion"), "TiposIntervencion");
                    oDialog.setModel(AppManagementHelper.getModel("TipoEquipoJsonModel"), "TipoEquipoJsonModel");
                    oDialog.setModel(oSelectModel, "SelectModel");
                    oDialog.setModel(oFiltersModel, "FiltersJsonModel");
                    oDialog.setModel(oHardCodeModel, "HardCodeModel");
                    oDialog.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                    oDialog.setModel(oRepModel, "RepositionTimes");
                    oDialog.setModel(oView.getModel("RepositionTimes"), "RepositionTimes");
                    oDialog.setModel(AppManagementHelper.getModel("TipoLicFiltersModel"), "TipoLicFiltersModel");
                    oDialog.setModel(AppManagementHelper.getModel("CheckAdvancedFiltersModel"), "CheckAdvancedFiltersModel");

                    this.advancedFilters = oDialog;
                    this.advancedFilters.open();
                }.bind(this));
            } else {
                // Si ya existe el diálogo, actualiza los modelos y ábrelo
                this.advancedFilters.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                this.advancedFilters.setModel(oSelectModel, "SelectModel");
                this.advancedFilters.setModel(oHardCodeModel, "HardCodeModel");
                this.advancedFilters.setModel(oFiltersModel, "FiltersJsonModel");
                this.advancedFilters.setModel(oRepModel, "RepositionTimes");
                this.advancedFilters.setModel(this.getView().getModel("RepositionTimes"), "RepositionTimes");
                this.advancedFilters.setModel(AppManagementHelper.getModel("WorkPlacesJsonModel"), "WorkPlacesJsonModel");
                this.advancedFilters.setModel(this.getView().getModel("GrupoPlanificador"), "GrupoPlanificador");
                this.advancedFilters.setModel(AppManagementHelper.getModel("TipoLicFiltersModel"), "TipoLicFiltersModel");
                this.advancedFilters.setModel(AppManagementHelper.getModel("CheckAdvancedFiltersModel"), "CheckAdvancedFiltersModel");
                this.advancedFilters.open();
            }
        },

        closeAdvancedFilters: function () {
            this.advancedFilters.close();
        },

    });
});
