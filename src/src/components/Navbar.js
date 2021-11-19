import React from 'react'
import logo from '../images/no-image.png'
import '../styles/navbar.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faWrench } from '@fortawesome/free-solid-svg-icons'

const Navbar = () => {

    const iconProps = {
        color: "white",
        size: "lg"
    }

    return (
        <nav>
            <div className="container nav-wrapper">
                <div className="nav-wrapper--tools">
                    <FontAwesomeIcon {...iconProps} icon={faEye}/>
                    <FontAwesomeIcon {...iconProps} icon={faWrench} />
                    <div className="nav-wrapper--tools__machineInfo">
                        <img src={logo} alt="ioBroker" />
                        <p>XOCT: DESKTOP-22T7OPM(SMARTHOME)</p>
                    </div>
                </div>
                <div className="nav-wrapper--packageInfo">
                    <p>ioBroker admin 2.6.12</p>
                    <img src={logo} alt="ioBroker" />
                </div>
            </div>
        </nav>
    )
}

export default Navbar