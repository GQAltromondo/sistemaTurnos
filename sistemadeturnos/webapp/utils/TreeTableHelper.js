/**
 * Helper para transformar datos planos en estructura jerárquica para TreeTable
 * Agrupa por Equipo + Horario
 */
sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Transforma un array plano de licencias en una estructura jerárquica
         * agrupada por Equipo + Horario
         * 
         * @param {Array} aLicencias - Array de licencias planas
         * @returns {Array} Array con estructura jerárquica para TreeTable
         */
        transformToTreeStructure: function (aLicencias) {
            if (!aLicencias || !Array.isArray(aLicencias) || aLicencias.length === 0) {
                return [];
            }

            // Agrupar por Equipo + Horario
            const grupos = {};

            aLicencias.forEach((licencia, index) => {
                const equipo = licencia.Equnr || "Sin Equipo";
                const turnoAsignado = licencia.TurnoAsignado || "Sin Turno";

                const grupoKey = `${equipo}|${turnoAsignado}`;

                if (!grupos[grupoKey]) {
                    grupos[grupoKey] = {
                        // Propiedades del nodo padre
                        _isGroup: true,
                        Equnr: equipo,
                        TurnoAsignado: turnoAsignado,
                        // Copiar datos de la primera licencia del grupo para mostrar en el padre
                        Equstat: licencia.Equstat,
                        Jobcond: licencia.Jobcond,
                        Comments: licencia.Comments,
                        Werks: licencia.Werks,
                        Consola: licencia.Consola,
                        Timbeg: licencia.Timbeg,
                        Gdate: licencia.Gdate,
                        InitHourSort: licencia.InitHourSort,
                        // Contador de hijos
                        _childCount: 0,
                        // Array de hijos
                        children: []
                    };
                }

                // Agregar licencia como hijo
                grupos[grupoKey].children.push({
                    ...licencia,
                    _isGroup: false,
                    _parentKey: grupoKey
                });

                grupos[grupoKey]._childCount++;
            });

            // Convertir el objeto de grupos a array
            const aTreeData = Object.values(grupos);

            // Ordenar grupos por Equipo y luego por TurnoAsignado
            aTreeData.sort((a, b) => {
                // Comparar por Equipo (string)
                if (a.Equnr !== b.Equnr) {
                    return a.Equnr.localeCompare(b.Equnr);
                }
                // Comparar por TurnoAsignado (formato HH:MM)
                const turnoA = a.TurnoAsignado || "00:00";
                const turnoB = b.TurnoAsignado || "00:00";
                return turnoA.localeCompare(turnoB);
            });


            return aTreeData;
        },

        /**
         * Aplica filtros a la estructura jerárquica
         * Si un hijo coincide con el filtro, se incluye todo el grupo padre
         * 
         * @param {Array} aTreeData - Datos con estructura jerárquica
         * @param {Array} aFilters - Array de filtros UI5
         * @returns {Array} Datos filtrados
         */
        applyFiltersToTree: function (aTreeData, aFilters) {
            if (!aFilters || aFilters.length === 0) {
                return aTreeData;
            }
            const aFilteredGroups = [];

            aTreeData.forEach(grupo => {
                // Filtrar hijos
                const aFilteredChildren = grupo.children.filter(child => {
                    return this._matchesFilters(child, aFilters);
                });

                // Si hay hijos que coinciden, incluir el grupo
                if (aFilteredChildren.length > 0) {
                    aFilteredGroups.push({
                        ...grupo,
                        children: aFilteredChildren,
                        _childCount: aFilteredChildren.length
                    });
                }
            });

            return aFilteredGroups;
        },

        /**
         * Verifica si un registro coincide con los filtros
         * 
         * @param {Object} oRecord - Registro a verificar
         * @param {Array} aFilters - Array de filtros
         * @returns {Boolean} true si coincide con todos los filtros
         */
        _matchesFilters: function (oRecord, aFilters) {
            return aFilters.every(filter => {
                const sPath = filter.sPath;
                const sOperator = filter.sOperator;
                const oValue1 = filter.oValue1;

                const recordValue = oRecord[sPath];

                switch (sOperator) {
                    case "EQ":
                        return recordValue === oValue1;
                    case "Contains":
                        return recordValue && String(recordValue).toLowerCase().includes(String(oValue1).toLowerCase());
                    case "StartsWith":
                        return recordValue && String(recordValue).startsWith(oValue1);
                    case "EndsWith":
                        return recordValue && String(recordValue).endsWith(oValue1);
                    default:
                        return true;
                }
            });
        }
    };
});