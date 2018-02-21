define([
        '../Core/PlaneGeometry',
        '../Core/PlaneOutlineGeometry',
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Check',
        '../Core/Color',
        '../Core/ColorGeometryInstanceAttribute',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/DistanceDisplayCondition',
        '../Core/DistanceDisplayConditionGeometryInstanceAttribute',
        '../Core/Event',
        '../Core/GeometryInstance',
        '../Core/Iso8601',
        '../Core/Matrix4',
        '../Core/ShowGeometryInstanceAttribute',
        '../Core/Quaternion',
        '../Scene/MaterialAppearance',
        '../Scene/PerInstanceColorAppearance',
        '../Scene/Primitive',
        '../Scene/ShadowMode',
        './ColorMaterialProperty',
        './ConstantProperty',
        './dynamicGeometryGetBoundingSphere',
        './GeometryUpdater',
        './MaterialProperty',
        './Property'
    ], function(
        PlaneGeometry,
        PlaneOutlineGeometry,
        Cartesian2,
        Cartesian3,
        Check,
        Color,
        ColorGeometryInstanceAttribute,
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        DistanceDisplayCondition,
        DistanceDisplayConditionGeometryInstanceAttribute,
        Event,
        GeometryInstance,
        Iso8601,
        Matrix4,
        ShowGeometryInstanceAttribute,
        Quaternion,
        MaterialAppearance,
        PerInstanceColorAppearance,
        Primitive,
        ShadowMode,
        ColorMaterialProperty,
        ConstantProperty,
        dynamicGeometryGetBoundingSphere,
        GeometryUpdater,
        MaterialProperty,
        Property) {
    'use strict';

    var scratchColor = new Color();

    function PlaneGeometryOptions(entity) {
        this.id = entity;
        this.vertexFormat = undefined;
        this.plane = undefined;
        this.dimensions = undefined;
    }

    /**
     * A {@link GeometryUpdater} for planes.
     * Clients do not normally create this class directly, but instead rely on {@link DataSourceDisplay}.
     * @alias PlaneGeometryUpdater
     * @constructor
     *
     * @param {Entity} entity The entity containing the geometry to be visualized.
     * @param {Scene} scene The scene where visualization is taking place.
     */
    function PlaneGeometryUpdater(entity, scene) {
        GeometryUpdater.call(this, {
            entity : entity,
            scene : scene,
            geometryOptions : new PlaneGeometryOptions(entity),
            geometryPropertyName : 'plane',
            observedPropertyNames : ['availability', 'position', 'orientation', 'plane']
        });
    }

    if (defined(Object.create)) {
        PlaneGeometryUpdater.prototype = Object.create(GeometryUpdater.prototype);
        PlaneGeometryUpdater.prototype.constructor = PlaneGeometryUpdater;
    }

    /**
     * Creates the geometry instance which represents the fill of the geometry.
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the filled portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent a filled geometry.
     */
    PlaneGeometryUpdater.prototype.createFillGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('time', time);

        if (!this._fillEnabled) {
            throw new DeveloperError('This instance does not represent a filled geometry.');
        }
        //>>includeEnd('debug');

        var entity = this._entity;
        var isAvailable = entity.isAvailable(time);

        var attributes;

        var color;
        var show = new ShowGeometryInstanceAttribute(isAvailable && entity.isShowing && this._showProperty.getValue(time) && this._fillProperty.getValue(time));
        var distanceDisplayCondition = this._distanceDisplayConditionProperty.getValue(time);
        var distanceDisplayConditionAttribute = DistanceDisplayConditionGeometryInstanceAttribute.fromDistanceDisplayCondition(distanceDisplayCondition);
        if (this._materialProperty instanceof ColorMaterialProperty) {
            var currentColor = Color.WHITE;
            if (defined(this._materialProperty.color) && (this._materialProperty.color.isConstant || isAvailable)) {
                currentColor = this._materialProperty.color.getValue(time);
            }
            color = ColorGeometryInstanceAttribute.fromColor(currentColor);
            attributes = {
                show : show,
                distanceDisplayCondition : distanceDisplayConditionAttribute,
                color : color
            };
        } else {
            attributes = {
                show : show,
                distanceDisplayCondition : distanceDisplayConditionAttribute
            };
        }

        var planeGraphics = entity.plane;
        var options = this._options;
        var modelMatrix = entity.computeModelMatrix(time);
        var plane = Property.getValueOrDefault(planeGraphics.plane, time, options.plane);
        var dimensions = Property.getValueOrUndefined(planeGraphics.dimensions, time, options.dimensions);
        if (!defined(modelMatrix) || !defined(plane) || !defined(dimensions)) {
            return;
        }

        options.plane = plane;
        options.dimensions = dimensions;

        modelMatrix = createPrimitiveMatrix(plane, dimensions, modelMatrix, modelMatrix);

        return new GeometryInstance({
            id : entity,
            geometry : new PlaneGeometry(this._options),
            modelMatrix : modelMatrix,
            attributes : attributes
        });
    };

    /**
     * Creates the geometry instance which represents the outline of the geometry.
     *
     * @param {JulianDate} time The time to use when retrieving initial attribute values.
     * @returns {GeometryInstance} The geometry instance representing the outline portion of the geometry.
     *
     * @exception {DeveloperError} This instance does not represent an outlined geometry.
     */
    PlaneGeometryUpdater.prototype.createOutlineGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('time', time);

        if (!this._outlineEnabled) {
            throw new DeveloperError('This instance does not represent an outlined geometry.');
        }
        //>>includeEnd('debug');

        var entity = this._entity;
        var isAvailable = entity.isAvailable(time);
        var outlineColor = Property.getValueOrDefault(this._outlineColorProperty, time, Color.BLACK);
        var distanceDisplayCondition = this._distanceDisplayConditionProperty.getValue(time);

        var planeGraphics = entity.plane;
        var options = this._options;
        var modelMatrix = entity.computeModelMatrix(time);
        var plane = Property.getValueOrDefault(planeGraphics.plane, time, options.plane);
        var dimensions = Property.getValueOrUndefined(planeGraphics.dimensions, time, options.dimensions);
        if (!defined(modelMatrix) || !defined(plane) || !defined(dimensions)) {
            return;
        }

        options.plane = plane;
        options.dimensions = dimensions;

        modelMatrix = createPrimitiveMatrix(plane, dimensions, modelMatrix, modelMatrix);

        return new GeometryInstance({
            id : entity,
            geometry : new PlaneOutlineGeometry(),
            modelMatrix : modelMatrix,
            attributes : {
                show : new ShowGeometryInstanceAttribute(isAvailable && entity.isShowing && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time)),
                color : ColorGeometryInstanceAttribute.fromColor(outlineColor),
                distanceDisplayCondition : DistanceDisplayConditionGeometryInstanceAttribute.fromDistanceDisplayCondition(distanceDisplayCondition)
            }
        });
    };

    PlaneGeometryUpdater.prototype._isHidden = function(entity, plane) {
        return !defined(plane.plane) || !defined(plane.dimensions) || !defined(entity.position) || GeometryUpdater.prototype._isHidden.call(this, entity, plane);
    };

    GeometryUpdater.prototype._getIsClosed = function(entity, plane) {
        return false;
    };

    PlaneGeometryUpdater.prototype._isDynamic = function(entity, plane) {
        return !entity.position.isConstant || //
               !Property.isConstant(entity.orientation) || //
               !plane.plane.isConstant || //
               !plane.dimensions.isConstant || //
               !Property.isConstant(plane.outlineWidth);
    };

    PlaneGeometryUpdater.prototype._setStaticOptions = function(entity, plane) {
        var isColorMaterial = this._materialProperty instanceof ColorMaterialProperty;

        var options = this._options;
        options.vertexFormat = isColorMaterial ? PerInstanceColorAppearance.VERTEX_FORMAT : MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat;
        options.plane = plane.plane.getValue(Iso8601.MINIMUM_VALUE, options.plane);
        options.dimensions = plane.dimensions.getValue(Iso8601.MINIMUM_VALUE, options.dimensions);
    };

    PlaneGeometryUpdater.DynamicGeometryUpdater = DynamicGeometryUpdater;

    /**
     * @private
     */
    function DynamicGeometryUpdater(geometryUpdater, primitives) {
        this._primitives = primitives;
        this._primitive = undefined;
        this._outlinePrimitive = undefined;
        this._geometryUpdater = geometryUpdater;
        this._options = new PlaneGeometryOptions(geometryUpdater._entity);
        this._entity = geometryUpdater._entity;
    }

    DynamicGeometryUpdater.prototype.update = function(time) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('time', time);
        //>>includeEnd('debug');

        var primitives = this._primitives;
        primitives.removeAndDestroy(this._primitive);
        primitives.removeAndDestroy(this._outlinePrimitive);
        this._primitive = undefined;
        this._outlinePrimitive = undefined;

        var geometryUpdater = this._geometryUpdater;
        var entity = this._entity;
        var planeGraphics = entity.plane;
        if (!entity.isShowing || !entity.isAvailable(time) || !Property.getValueOrDefault(planeGraphics.show, time, true)) {
            return;
        }

        var options = this._options;
        var modelMatrix = entity.computeModelMatrix(time);
        var plane = Property.getValueOrDefault(planeGraphics.plane, time, options.plane);
        var dimensions = Property.getValueOrUndefined(planeGraphics.dimensions, time, options.dimensions);
        if (!defined(modelMatrix) || !defined(plane) || !defined(dimensions)) {
            return;
        }

        options.plane = plane;
        options.dimensions = dimensions;

        modelMatrix = createPrimitiveMatrix(plane, dimensions, modelMatrix, modelMatrix);

        var shadows = this._geometryUpdater.shadowsProperty.getValue(time);

        var distanceDisplayConditionProperty = this._geometryUpdater.distanceDisplayConditionProperty;
        var distanceDisplayCondition = distanceDisplayConditionProperty.getValue(time);
        var distanceDisplayConditionAttribute = DistanceDisplayConditionGeometryInstanceAttribute.fromDistanceDisplayCondition(distanceDisplayCondition);

        if (Property.getValueOrDefault(planeGraphics.fill, time, true)) {
            var material = MaterialProperty.getValue(time, geometryUpdater.fillMaterialProperty, this._material);
            this._material = material;

            var appearance = new MaterialAppearance({
                material : material,
                translucent : material.isTranslucent(),
                closed : true
            });
            options.vertexFormat = appearance.vertexFormat;

            this._primitive = primitives.add(new Primitive({
                geometryInstances : new GeometryInstance({
                    id : entity,
                    geometry : new PlaneGeometry(),
                    modelMatrix : modelMatrix,
                    attributes : {
                        distanceDisplayCondition : distanceDisplayConditionAttribute
                    }
                }),
                appearance : appearance,
                asynchronous : false,
                shadows : shadows
            }));
        }

        if (Property.getValueOrDefault(planeGraphics.outline, time, false)) {
            options.vertexFormat = PerInstanceColorAppearance.VERTEX_FORMAT;

            var outlineColor = Property.getValueOrClonedDefault(planeGraphics.outlineColor, time, Color.BLACK, scratchColor);
            var outlineWidth = Property.getValueOrDefault(planeGraphics.outlineWidth, time, 1.0);
            var translucent = outlineColor.alpha !== 1.0;

            this._outlinePrimitive = primitives.add(new Primitive({
                geometryInstances : new GeometryInstance({
                    id : entity,
                    geometry : new PlaneOutlineGeometry(),
                    modelMatrix : modelMatrix,
                    attributes : {
                        color : ColorGeometryInstanceAttribute.fromColor(outlineColor),
                        distanceDisplayCondition : distanceDisplayConditionAttribute
                    }
                }),
                appearance : new PerInstanceColorAppearance({
                    flat : true,
                    translucent : translucent,
                    renderState : {
                        lineWidth : geometryUpdater._scene.clampLineWidth(outlineWidth)
                    }
                }),
                asynchronous : false,
                shadows : shadows
            }));
        }
    };

    var scratchTranslation = new Cartesian3();
    var scratchNormal = new Cartesian3();
    var scratchScale = new Cartesian3();
    function createPrimitiveMatrix (plane, dimensions, modelMatrix, result) {
        var normal;
        var distance;
        if (defined(plane)) {
            normal = plane.normal;
            distance = plane.distance;
        } else {
            normal = Cartesian3.clone(Cartesian3.UNIT_X, scratchNormal);
            distance = 0.0;
        }

        if (!defined(dimensions)) {
            dimensions = new Cartesian2(1.0, 1.0);
        }

        var translation = Cartesian3.multiplyByScalar(normal, -distance, scratchTranslation);
        translation = Matrix4.multiplyByPoint(modelMatrix, translation, translation);

        var transformedNormal = Matrix4.multiplyByPointAsVector(modelMatrix, normal, scratchNormal);
        Cartesian3.normalize(transformedNormal, transformedNormal);
        var rotation = getRotationMatrix(transformedNormal, Cartesian3.UNIT_Z);

        var scale = Cartesian2.clone(dimensions, scratchScale);
        scale.z = 1.0;

        return Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, result);
    }

    // get a rotation according to a normal
    var scratchAxis = new Cartesian3();
    var scratchQuaternion = new Quaternion();
    function getRotationMatrix(direction, up) {
        var angle = Cartesian3.angleBetween(direction, up);
        if (angle === 0.0) {
            return Quaternion.clone(Quaternion.IDENTITY, scratchQuaternion);
        }

        var axis = Cartesian3.cross(up, direction, scratchAxis);
        return Quaternion.fromAxisAngle(axis, angle, scratchQuaternion);
    }

    DynamicGeometryUpdater.prototype.getBoundingSphere = function(result) {
        return dynamicGeometryGetBoundingSphere(this._entity, this._primitive, this._outlinePrimitive, result);
    };

    DynamicGeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    DynamicGeometryUpdater.prototype.destroy = function() {
        var primitives = this._primitives;
        primitives.removeAndDestroy(this._primitive);
        primitives.removeAndDestroy(this._outlinePrimitive);
        destroyObject(this);
    };

    return PlaneGeometryUpdater;
});
