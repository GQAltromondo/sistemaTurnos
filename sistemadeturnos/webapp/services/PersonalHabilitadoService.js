sap.ui.define([
	"Transener/Operaciones/LicenciasTrabajo/services/ganttService/oDataService",
	"Transener/Operaciones/LicenciasTrabajo/utils/FioriHelper",
	//	"Transener/Operaciones/LicenciasTrabajo/utils/FioriComponentHelper",
	//	"Transener/Operaciones/LicenciasTrabajo/utils/FormatHelper",
	//	"Transener/Operaciones/LicenciasTrabajo/utils/i18nTranslationHelper",
	//	"Transener/Operaciones/LicenciasTrabajo/utils/MessageBoxHelper",
	"Transener/Operaciones/LicenciasTrabajo/utils/Gantt/ModelHelper",

], function (oDataServices, FioriHelper,
	// FioriComponentHelper, FormatHelper, i18nTranslationHelper, MessageBoxHelper, 
	ModelHelper) {
	"use strict";

	return {
		//PersonalHabilitadoSet
		_entitySet: "/PersonalHabilitadoSet",

		//TODO SEGUIR AHORITA
		_filterPersonal: function (aData) {
			var aFilteredByRegion = _.filter(aData, {})

		},

		/*****************************************************get company list************************************************************/
		getPersonalPromise: function (sSociedad) {
			var aPromise = [];
			aPromise.push(this.getJefeTrabajoPromise(sSociedad));
			aPromise.push(this.getSolicitantePromise(sSociedad));
			aPromise.push(this.getPromise(sSociedad));
			aPromise.push(this.getPersonalHabilitadoTecnicosEt(sSociedad));
			aPromise.push(this.getJefeTrabajoTctPromise(sSociedad));
			Promise.all(aPromise).then(function (aPromisesResolved) {
				var oModel = ModelHelper.getModel("PersonalHabilitadoModel");
				let all = aPromisesResolved[2].results;
				let map = new Map();
				let todos = [];
				all.forEach(el => {
					if (!map.has(el.Legajo)) {
						map.set(el.Legajo, true); // set any value to Map
						todos.push(el);
					}
				});

				oModel.setData({
					JefeDeTrabajo: aPromisesResolved[0].results,
					Solicitante: aPromisesResolved[1].results,
					Todos: Array.from(todos),
					TecnicosEt: aPromisesResolved[3].results,
					JefeDeTrabajoTct: aPromisesResolved[4].results,
				})
				
			}).catch(function (e) {
			})
		},

		getFiltersPersonalHabilitado: function (sType, sSociedad, sClase, sLote, sLote2) {
			let filters = [];
			filters.push(new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sSociedad));
			if (sType) {
				filters.push(new sap.ui.model.Filter("TipoHab", sap.ui.model.FilterOperator.EQ, sType));
			}
			if (sClase) {
				filters.push(new sap.ui.model.Filter("ClaseHab", sap.ui.model.FilterOperator.EQ, sClase));
			}
			if (sLote) {
				filters.push(
					new sap.ui.model.Filter({
						path: "Lote",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: sLote,
						value2: sLote2,
						caseSensitive: false
					})
				);
			}
			return filters;
		},

		getPersonalHabilitadoTecnicosEt: function (sSociedad) {
			var that = this;
			return new Promise(function (resolve, reject) {
				oDataServices.getModel("TransenerOperaciones").read("/PersonalHabilitadoTecnicosEtSet", {
					filters: that.getFiltersPersonalHabilitado("", sSociedad),
					success: resolve,
					error: reject
				})
			})
		},

		getJefeTrabajoPromise: function (sSociedad) {
			var that = this;
			return new Promise(function (resolve, reject) {
				oDataServices.getModel("TransenerOperaciones").read(that._entitySet, {

					filters: that.getFiltersPersonalHabilitado("JT", sSociedad, "H0001", ""),
					success: resolve,
					error: reject
				})
			})
		},

		getJefeTrabajoTctPromise: function (sSociedad) {
			var that = this;
			return new Promise(function (resolve, reject) {
				oDataServices.getModel("TransenerOperaciones").read(that._entitySet, {

					filters: that.getFiltersPersonalHabilitado("", sSociedad, "H0002", "J", "JN"),

					success: resolve,
					error: reject
				})
			})
		},

		getSolicitantePromise: function (sSociedad) {
			var that = this;
			return new Promise(function (resolve, reject) {
				oDataServices.getModel("TransenerOperaciones").read(that._entitySet, {
					filters: that.getFiltersPersonalHabilitado("SO", sSociedad),
					success: resolve,
					error: reject
				})
			})
		},

		getPromise: function (sSociedad) {
			var that = this;
			return new Promise(function (resolve, reject) {
				oDataServices.getModel("TransenerOperaciones").read(that._entitySet, {
					filters: that.getFiltersPersonalHabilitado("", sSociedad),
					success: resolve,
					error: reject
				})
			})
		},

		loadPersonal: function (society) {
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter({
				path: "Empresa",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: society
			}));
			oDataServices.getModel("TransenerOperaciones").read(this._entitySet, {
				filters: aFilters,
				success: function (data) {
					var oModel = ModelHelper.getModel("PersonalHabilitadoModel");
					oModel.setData({
						Solicitante: _.filter(data.results, {
							TipoHab: "SO"
						}),
						JefeDeTrabajo: _.filter(data.results, {
							TipoHab: "JT"
						})
					})
				},
				error: function () {
					console.log("Se ha producido un error al cargar el personal habilitado")
				}
			})
		}

	};
});